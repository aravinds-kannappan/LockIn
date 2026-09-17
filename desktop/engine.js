"use strict";

const path = require("path");
const {
  loadMemory,
  saveMemory,
  greet,
  suggestTask,
  recordSession,
  recordBlock,
  learnedHosts,
} = require("../shared/learning");
const { SAMPLE_TASKS } = require("../shared/sites");
const {
  DEFAULT_API_PORT,
  DEFAULT_PROXY_PORT,
  startControlServer,
  setSystemPac,
} = require("./server");
const { startProxy } = require("./blocker");
const { startWatchdog } = require("./watchdog");

function createEngine(options = {}) {
  const apiPort = options.apiPort || DEFAULT_API_PORT;
  const proxyPort = options.proxyPort || DEFAULT_PROXY_PORT;
  const memoryPath =
    options.memoryPath ||
    path.join(require("os").homedir(), "Library", "Application Support", "LockIn", "memory.json");

  let memory = loadMemory(memoryPath);
  const listeners = new Map();

  const state = {
    phase: "setup",
    locked: false,
    task: "",
    notes: "",
    startedAt: null,
    blockedEvents: [],
    escapeAttempts: 0,
    checklist: [],
    extraHosts: learnedHosts(memory),
    apiPort,
    proxyPort,
    pacEnabled: false,
    pacResults: [],
    loginItemEnabled: memory.loginItemEnabled !== false,
  };

  function emit(event, payload) {
    for (const cb of listeners.get(event) || []) cb(payload);
    for (const cb of listeners.get("change") || []) cb(getPublic());
  }

  function on(event, cb) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return () => listeners.get(event).delete(cb);
  }

  function persist() {
    memory.loginItemEnabled = state.loginItemEnabled;
    saveMemory(memoryPath, memory);
  }

  function getPublic() {
    const greeting = greet(memory);
    return {
      phase: state.phase,
      locked: state.locked,
      task: state.task,
      notes: state.notes,
      startedAt: state.startedAt,
      now: Date.now(),
      elapsedMs: state.startedAt ? Date.now() - state.startedAt : 0,
      blockedEvents: state.blockedEvents.slice(-40),
      blockedAttempts: state.blockedEvents.length,
      escapeAttempts: state.escapeAttempts,
      extraHosts: state.extraHosts,
      greeting,
      suggestedTask: greeting.suggestedTask,
      sampleTasks: SAMPLE_TASKS,
      loginItemEnabled: state.loginItemEnabled,
      pacEnabled: state.pacEnabled,
      apiPort,
      proxyPort,
      memoryPath,
      checklist: state.checklist,
      checklistDone: state.checklist.filter((t) => t.done).length,
      recap: state.recap || null,
      stats: {
        sessions: memory.sessions.length,
        completed: memory.completedCount,
        abandoned: memory.abandonedCount,
        totalBlocks: memory.totalBlocks,
      },
    };
  }

  function handleBlocked(match, url, source = "network") {
    if (!state.locked || !match) return;
    const last = state.blockedEvents[state.blockedEvents.length - 1];
    if (last && last.host === match.host && Date.now() - last.at < 1200) return;
    state.blockedEvents.push({
      host: match.host,
      name: match.name,
      url: url || match.host,
      source,
      at: Date.now(),
    });
    recordBlock(memory, match.host);
    persist();
    emit("blocked", match);
  }

  async function enableBlocks() {
    if (process.env.LOCKIN_SKIP_WATCHDOG !== "1") {
      watchdog.start();
    }
    if (process.env.LOCKIN_SKIP_PAC === "1") {
      state.pacEnabled = false;
      return;
    }
    const pacUrl = `http://127.0.0.1:${apiPort}/lockin.pac`;
    try {
      const results = await setSystemPac(pacUrl, true);
      state.pacResults = results;
      state.pacEnabled = results.some((r) => r.setOn?.ok || r.setUrl?.ok);
    } catch {
      state.pacEnabled = false;
    }
    watchdog.start();
  }

  async function disableBlocks() {
    watchdog.stop();
    try {
      await setSystemPac(`http://127.0.0.1:${apiPort}/lockin.pac`, false);
    } catch {
      // ignore
    }
    state.pacEnabled = false;
  }

  const watchdog = startWatchdog({
    getState: () => state,
    blockUrlFor: (match) =>
      `http://127.0.0.1:${apiPort}/blocked?site=${encodeURIComponent(match.name)}&host=${encodeURIComponent(match.host)}`,
    onBlocked: (match, url, app) => handleBlocked(match, url, app || "watchdog"),
  });

  async function start() {
    await startControlServer({
      port: apiPort,
      proxyPort,
      getState: () => state,
      onBlocked: (match, url) => handleBlocked(match, url, "extension"),
      onLock: (task) => lock(task),
      onAbandon: () => endSession(""),
    });
    await startProxy(proxyPort, () => state, (match, url) =>
      handleBlocked(match, url, "proxy"),
    );
  }

  function validateTask(task) {
    const next = String(task || "").trim();
    if (!next) return "Name the task first.";
    if (next.length < 8) return "Too vague — write a real task.";
    return null;
  }

  async function lock(task) {
    const error = validateTask(task);
    if (error) return { ok: false, error };
    state.task = String(task).trim();
    state.notes = "";
    state.blockedEvents = [];
    state.escapeAttempts = 0;
    state.checklist = [];
    state.extraHosts = learnedHosts(memory);
    state.phase = "locking";
    state.locked = false;
    state.recap = null;
    emit("change");
    setTimeout(async () => {
      state.startedAt = Date.now();
      state.locked = true;
      state.phase = "locked";
      await enableBlocks();
      emit("change");
    }, 1200);
    return { ok: true };
  }

  function suggest() {
    return suggestTask(memory);
  }

  async function endSession(note) {
    const durationMs = state.startedAt ? Date.now() - state.startedAt : 0;
    const blockedHosts = [...new Set(state.blockedEvents.map((e) => e.host))];
    const trimmedNote = String(note || "").trim();
    const checklistDone = state.checklist.filter((t) => t.done).length;
    const recap = {
      task: state.task,
      abandoned: !trimmedNote,
      durationMs,
      blockedAttempts: state.blockedEvents.length,
      escapeAttempts: 0,
      explanation: trimmedNote,
      verdict: trimmedNote ? "Session complete." : "Ended without a note.",
      blockedHosts,
      checklist: state.checklist.map((t) => ({ text: t.text, done: t.done })),
      checklistDone,
      checklistTotal: state.checklist.length,
    };
    recordSession(memory, recap);
    persist();
    state.recap = recap;
    state.locked = false;
    state.phase = "recap";
    state.startedAt = null;
    await disableBlocks();
    emit("change");
    return { ok: true, recap };
  }

  function reset() {
    state.phase = "setup";
    state.task = "";
    state.notes = "";
    state.recap = null;
    state.blockedEvents = [];
    state.checklist = [];
    state.escapeAttempts = 0;
    emit("change");
  }

  function addChecklistItem(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: trimmed,
      done: false,
    };
    state.checklist.push(item);
    emit("change");
    return item;
  }

  function toggleChecklistItem(id) {
    const item = state.checklist.find((t) => t.id === id);
    if (item) {
      item.done = !item.done;
      emit("change");
    }
    return item;
  }

  function removeChecklistItem(id) {
    state.checklist = state.checklist.filter((t) => t.id !== id);
    emit("change");
  }

  function setNotes(notes) {
    state.notes = notes;
  }

  function setLoginItemEnabled(enabled) {
    state.loginItemEnabled = Boolean(enabled);
    persist();
    emit("change");
    return state.loginItemEnabled;
  }

  async function quickLock() {
    if (state.locked) return { ok: true, alreadyLocked: true };
    const task = suggestTask(memory);
    return lock(task);
  }

  return {
    start,
    lock,
    quickLock,
    suggest,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    endSession,
    reset,
    setNotes,
    setLoginItemEnabled,
    getPublic,
    on,
    handleBlocked,
    memoryPath,
    apiPort,
    proxyPort,
    enableBlocks,
    disableBlocks,
    validateTask,
  };
}

module.exports = { createEngine };
