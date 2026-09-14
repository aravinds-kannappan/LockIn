"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const fs = require("fs");

const { matchBlocked, parseHost, formatDuration } = require("../shared/sites");
const { reviewExplanation } = require("../shared/review");
const { greet, recordSession, suggestTask, emptyMemory, shouldBeStrict } = require("../shared/learning");
const { startProxy } = require("../desktop/blocker");
const { parseTabDump } = require("../desktop/watchdog");

describe("site matching", () => {
  it("blocks youtube and aliases", () => {
    assert.equal(matchBlocked("https://www.youtube.com/watch?v=dQw4w9WgXcQ").name, "YouTube");
    assert.equal(matchBlocked("youtu.be").name, "YouTube");
    assert.equal(matchBlocked("https://github.com"), null);
  });

  it("parses hosts", () => {
    assert.equal(parseHost("https://WWW.Reddit.com/r/all"), "reddit.com");
  });

  it("formats duration", () => {
    assert.equal(formatDuration(5_000), "00:05");
    assert.equal(formatDuration(3_661_000), "1:01:01");
  });
});

describe("debrief judgment", () => {
  const task = "Draft the Q3 hiring brief for the senior backend role";

  it("rejects empty and generic text", () => {
    assert.equal(reviewExplanation(task, "").accepted, false);
    assert.equal(reviewExplanation(task, "I did the work").accepted, false);
  });

  it("rejects a debrief that never mentions the task", () => {
    const result = reviewExplanation(
      task,
      "I spent the whole morning cleaning my inbox and chatting with friends about lunch plans.",
    );
    assert.equal(result.accepted, false);
  });

  it("accepts a specific debrief", () => {
    const result = reviewExplanation(
      task,
      "I outlined the hiring brief: role scope, must-have backend skills, interview loop, and a first draft of the posting for the senior backend seat.",
    );
    assert.equal(result.accepted, true);
  });

  it("gets stricter after a sloppy last lock", () => {
    const memory = emptyMemory();
    recordSession(memory, { task, abandoned: true, escapeAttempts: 3, blockedAttempts: 5 });
    assert.equal(shouldBeStrict(memory), true);
  });
});

describe("learning", () => {
  it("greets a new machine differently than a returning one", () => {
    const fresh = greet(emptyMemory());
    assert.match(fresh.headline, /First lock/);
    const memory = emptyMemory();
    recordSession(memory, {
      task: "Write the first 800 words of the LockIn landing page",
      abandoned: true,
      durationMs: 120000,
      blockedHosts: ["youtube.com"],
      blockedAttempts: 1,
    });
    const next = greet(memory);
    assert.match(next.body, /youtube.com|landing page|broke/i);
    assert.equal(suggestTask(memory), "Write the first 800 words of the LockIn landing page");
  });
});

describe("watchdog dump parser", () => {
  it("parses chrome tab rows", () => {
    const rows = parseTabDump("1\t2\thttps://youtube.com/\n1\t3\thttps://github.com");
    assert.equal(rows[0].tabIndex, 2);
    assert.equal(rows[0].url, "https://youtube.com/");
  });
});

describe("blocking proxy", () => {
  it("refuses HTTPS CONNECT to youtube while locked", async () => {
    const tmp = path.join(os.tmpdir(), `lockin-memory-${Date.now()}.json`);
    const getState = () => ({ locked: true, extraHosts: [], task: "Test lock" });
    const server = await startProxy(0, getState, () => {});
    const port = server.address().port;
    const body = await new Promise((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.write("CONNECT youtube.com:443 HTTP/1.1\r\nHost: youtube.com:443\r\n\r\n");
      });
      socket.setTimeout(3000);
      socket.on("data", (chunk) => {
        socket.end();
        resolve(chunk.toString("utf8"));
      });
      socket.on("timeout", () => reject(new Error("proxy timeout")));
      socket.on("error", reject);
    });
    server.close();
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    assert.match(body, /403/);
    assert.match(body, /LockIn blocked YouTube/);
  });

  it("does not 403 youtube when unlocked", async () => {
    const server = await startProxy(0, () => ({ locked: false, extraHosts: [] }), () => {});
    const port = server.address().port;
    const body = await new Promise((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () => {
        socket.write("CONNECT youtube.com:443 HTTP/1.1\r\nHost: youtube.com:443\r\n\r\n");
      });
      socket.setTimeout(3000);
      socket.on("data", (chunk) => {
        socket.end();
        resolve(chunk.toString("utf8"));
      });
      socket.on("timeout", () => reject(new Error("proxy timeout")));
      socket.on("error", reject);
    });
    server.close();
    assert.match(body, /502/);
  });
});

describe("control PAC", () => {
  it("serves DIRECT when unlocked and PROXY when locked", async () => {
    const { startControlServer } = require("../desktop/server");
    const state = { locked: false, extraHosts: [], task: "", proxyPort: 18792 };
    const server = await startControlServer({
      port: 0,
      proxyPort: 18792,
      getState: () => state,
      onBlocked: () => {},
    });
    const port = server.address().port;
    const unlocked = await fetchPac(port);
    assert.match(unlocked, /var locked = false/);
    state.locked = true;
    const locked = await fetchPac(port);
    assert.match(locked, /var locked = true/);
    assert.match(locked, /youtube.com/);
    server.close();
  });
});

function fetchPac(port) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/lockin.pac`, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}
