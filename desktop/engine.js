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
  shouldBeStrict,
} = require("../shared/learning");
const { SAMPLE_TASKS } = require("../shared/sites");
const { reviewExplanation } = require("../shared/review");
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
    explanation: "",
    reviewError: null,
    reviewing: false,
    recap: null,
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
      explanation: state.explanation,
      reviewError: state.reviewError,
      reviewing: state.reviewing,
      recap: state.recap,
      extraHosts: state.extraHosts,
      greeting,
      suggestedTask: greeting.suggestedTask,
      sampleTasks: SAMPLE_TASKS,
      loginItemEnabled: state.loginItemEnabled,
      pacEnabled: state.pacEnabled,
      apiPort,
      proxyPort,
      memoryPath,
      stats: {
        sessions: memory.sessions.length,
        completed: memory.completedCount,
        abandoned: memory.abandonedCount,
        totalBlocks: memory.totalBlocks,
        totalEscapes: memory.totalEscapes,
        hostHits: memory.hostHits,
      },
    };
  }

  function handleBlocked(match, url, source = "network") {
    if (!state.locked || !match) return;
    const last = state.blockedEvents[state.blockedEvents.length - 1];
    if (last && last.host === match.host && Date.now() - last.at < 1200) {
      return;
    }
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
    } catch (error) {
      state.pacEnabled = false;
      state.pacResults = [{ error: String(error) }];
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
    });
    await startProxy(proxyPort, () => state, (match, url) =>
      handleBlocked(match, url, "proxy"),
    );
  }

  function validateTask(task) {
    const next = String(task || "").trim();
    if (!next) return "Name the task first. A blank lock is just a screensaver.";
    if (next.length < 8) return "Too vague. Write a task someone else could grade.";
    return null;
  }

  async function lock(task) {
    const error = validateTask(task);
    if (error) return { ok: false, error };
    state.task = String(task).trim();
    state.notes = "";
    state.blockedEvents = [];
    state.escapeAttempts = 0;
    state.explanation = "";
    state.reviewError = null;
    state.reviewing = false;
    state.recap = null;
    state.extraHosts = learnedHosts(memory);
    state.phase = "locking";
    state.locked = false;
    emit("change");
    setTimeout(async () => {
      state.startedAt = Date.now();
      state.locked = true;
      state.phase = "locked";
      await enableBlocks();
      emit("change");
    }, 1600);
    return { ok: true };
  }

  function suggest() {
    return suggestTask(memory);
  }

  async function finish(abandoned, verdict, text) {
    const durationMs = state.startedAt ? Date.now() - state.startedAt : 0;
    const blockedHosts = [...new Set(state.blockedEvents.map((e) => e.host))];
    const recap = {
      task: state.task,
      abandoned,
      durationMs,
      blockedAttempts: state.blockedEvents.length,
      escapeAttempts: state.escapeAttempts,
      explanation: text || "",
      verdict,
      blockedHosts,
    };
    recordSession(memory, recap);
    persist();
    state.recap = recap;
    state.locked = false;
    state.phase = "recap";
    state.startedAt = null;
    await disableBlocks();
    emit("change");
    return recap;
  }

  function beginEscape() {
    if (!state.locked) return getPublic();
    state.escapeAttempts += 1;
    emit("change");
    return getPublic();
  }

  async function abandon() {
    return finish(true, "Broken lock.", "");
  }

  function beginDone() {
    state.reviewError = null;
    emit("change");
  }

  async function submitDebrief(text) {
    state.reviewing = true;
    state.explanation = text;
    emit("change");
    const result = reviewExplanation(state.task, text, {
      strict: shouldBeStrict(memory),
    });
    await new Promise((r) => setTimeout(r, 700));
    if (!result.accepted) {
      state.reviewing = false;
      state.reviewError = result.message;
      emit("change");
      return { ok: false, error: result.message };
    }
    state.reviewing = false;
    state.reviewError = null;
    await finish(false, result.message, String(text).trim());
    return { ok: true };
  }

  function reset() {
    state.phase = "setup";
    state.task = "";
    state.notes = "";
    state.explanation = "";
    state.reviewError = null;
    state.recap = null;
    state.blockedEvents = [];
    state.escapeAttempts = 0;
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

  return {
    start,
    lock,
    suggest,
    beginEscape,
    abandon,
    beginDone,
    submitDebrief,
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
