"use strict";

const fs = require("fs");
const path = require("path");
const { SAMPLE_TASKS } = require("./sites");

function emptyMemory() {
  return {
    version: 1,
    createdAt: Date.now(),
    sessions: [],
    hostHits: {},
    totalEscapes: 0,
    totalBlocks: 0,
    completedCount: 0,
    abandonedCount: 0,
    loginItemEnabled: true,
  };
}

function loadMemory(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return { ...emptyMemory(), ...parsed, sessions: parsed.sessions || [] };
  } catch {
    return emptyMemory();
  }
}

function saveMemory(filePath, memory) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(memory, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
}

function topHost(memory) {
  const entries = Object.entries(memory.hostHits || {});
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0] ? { host: entries[0][0], count: entries[0][1] } : null;
}

function lastSession(memory) {
  return memory.sessions.length
    ? memory.sessions[memory.sessions.length - 1]
    : null;
}

function lastAbandoned(memory) {
  for (let i = memory.sessions.length - 1; i >= 0; i -= 1) {
    if (memory.sessions[i].abandoned) return memory.sessions[i];
  }
  return null;
}

function shouldBeStrict(memory) {
  const last = lastSession(memory);
  if (!last) return false;
  return last.abandoned || last.escapeAttempts >= 2 || last.blockedAttempts >= 4;
}

function learnedHosts(memory) {
  return Object.entries(memory.hostHits || {})
    .filter(([, count]) => count >= 2)
    .map(([host]) => host);
}

function greet(memory) {
  if (!memory.sessions.length) {
    return {
      headline: "First lock on this machine.",
      body: "Name one task. I'll remember how you work — the tasks, the debriefs, the sites you try to open, the escapes. Next time I lock you, I'll use that.",
      suggestedTask: SAMPLE_TASKS[0],
    };
  }

  const last = lastSession(memory);
  const top = topHost(memory);
  const abandoned = lastAbandoned(memory);
  const bits = [];

  if (last?.abandoned) {
    bits.push(
      `Last lock broke after ${Math.max(1, Math.round((last.durationMs || 0) / 60000))}m on “${last.task}”.`,
    );
  } else if (last) {
    bits.push(
      `Last lock: “${last.task}” for ${Math.max(1, Math.round((last.durationMs || 0) / 60000))}m. Debrief accepted.`,
    );
  }

  if (top) {
    bits.push(
      `You reach for ${top.host} when it gets hard (${top.count} hits on file). That tab dies while locked.`,
    );
  }

  if (memory.totalEscapes > 0) {
    bits.push(
      `${memory.totalEscapes} escape ${memory.totalEscapes === 1 ? "try" : "tries"} logged. Quitting still takes work.`,
    );
  }

  if (abandoned && (!last || last.task !== abandoned.task || last.abandoned)) {
    bits.push(`Unfinished: “${abandoned.task}”.`);
  }

  return {
    headline:
      memory.sessions.length === 1
        ? "I remember the last lock."
        : `I remember ${memory.sessions.length} locks on this machine.`,
    body: bits.join(" "),
    suggestedTask: abandoned?.task || last?.task || SAMPLE_TASKS[0],
  };
}

function suggestTask(memory) {
  const abandoned = lastAbandoned(memory);
  if (abandoned) return abandoned.task;
  const last = lastSession(memory);
  if (last && !last.abandoned) {
    const idx = SAMPLE_TASKS.findIndex((t) => t === last.task);
    return SAMPLE_TASKS[(idx + 1) % SAMPLE_TASKS.length];
  }
  return SAMPLE_TASKS[Math.floor(Math.random() * SAMPLE_TASKS.length)];
}

function recordSession(memory, recap) {
  const session = {
    task: recap.task,
    abandoned: Boolean(recap.abandoned),
    durationMs: recap.durationMs || 0,
    blockedAttempts: recap.blockedAttempts || 0,
    escapeAttempts: recap.escapeAttempts || 0,
    explanation: recap.explanation || "",
    verdict: recap.verdict || "",
    blockedHosts: recap.blockedHosts || [],
    at: Date.now(),
  };
  memory.sessions.push(session);
  if (memory.sessions.length > 80) {
    memory.sessions = memory.sessions.slice(-80);
  }
  memory.totalEscapes += session.escapeAttempts;
  memory.totalBlocks += session.blockedAttempts;
  if (session.abandoned) memory.abandonedCount += 1;
  else memory.completedCount += 1;
  for (const host of session.blockedHosts) {
    memory.hostHits[host] = (memory.hostHits[host] || 0) + 1;
  }
  return memory;
}

function recordBlock(memory, host) {
  if (!host) return memory;
  memory.hostHits[host] = (memory.hostHits[host] || 0) + 1;
  memory.totalBlocks += 1;
  return memory;
}

module.exports = {
  emptyMemory,
  loadMemory,
  saveMemory,
  topHost,
  lastSession,
  lastAbandoned,
  shouldBeStrict,
  learnedHosts,
  greet,
  suggestTask,
  recordSession,
  recordBlock,
};
