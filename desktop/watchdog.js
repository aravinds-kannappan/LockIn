"use strict";

const { execFile } = require("child_process");
const { matchBlocked, parseHost } = require("../shared/sites");

const LOCAL_MARK = "127.0.0.1";

function runOsa(script, timeoutMs = 4000) {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", script],
      { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve("");
          return;
        }
        resolve(String(stdout || "").trim());
      },
    );
  });
}

function chromeListScript() {
  return `
if application "Google Chrome" is running then
  tell application "Google Chrome"
    set out to ""
    repeat with w from 1 to (count of windows)
      repeat with t from 1 to (count of tabs of window w)
        set out to out & w & "\\t" & t & "\\t" & (URL of tab t of window w) & linefeed
      end repeat
    end repeat
    return out
  end tell
end if
`;
}

function safariListScript() {
  return `
if application "Safari" is running then
  tell application "Safari"
    set out to ""
    repeat with w from 1 to (count of windows)
      repeat with t from 1 to (count of tabs of window w)
        try
          set out to out & w & "\\t" & t & "\\t" & (URL of tab t of window w) & linefeed
        end try
      end repeat
    end repeat
    return out
  end tell
end if
`;
}

function chromeRedirectScript(windowIndex, tabIndex, url) {
  const safe = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `
if application "Google Chrome" is running then
  tell application "Google Chrome"
    set URL of tab ${tabIndex} of window ${windowIndex} to "${safe}"
  end tell
end if
`;
}

function safariRedirectScript(windowIndex, tabIndex, url) {
  const safe = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `
if application "Safari" is running then
  tell application "Safari"
    set URL of tab ${tabIndex} of window ${windowIndex} to "${safe}"
  end tell
end if
`;
}

function parseTabDump(dump) {
  return String(dump || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [w, t, ...rest] = line.split("\t");
      return {
        windowIndex: Number(w),
        tabIndex: Number(t),
        url: rest.join("\t"),
      };
    })
    .filter((row) => row.windowIndex > 0 && row.tabIndex > 0 && row.url);
}

function startWatchdog({ getState, blockUrlFor, onBlocked, intervalMs = 800 }) {
  let timer = null;
  let busy = false;

  async function scanBrowser(app, dump, redirect) {
    const state = getState();
    if (!state.locked) return;
    for (const tab of parseTabDump(dump)) {
      if (!tab.url || tab.url.includes(LOCAL_MARK) || tab.url.startsWith("chrome://") || tab.url.startsWith("safari-web")) {
        continue;
      }
      const match = matchBlocked(tab.url, state.extraHosts);
      if (!match) continue;
      onBlocked?.(match, tab.url, app);
      await runOsa(redirect(tab.windowIndex, tab.tabIndex, blockUrlFor(match)));
    }
  }

  async function tick() {
    if (busy) return;
    const state = getState();
    if (!state.locked) return;
    busy = true;
    try {
      const [chromeDump, safariDump] = await Promise.all([
        runOsa(chromeListScript()),
        runOsa(safariListScript()),
      ]);
      await scanBrowser("chrome", chromeDump, chromeRedirectScript);
      await scanBrowser("safari", safariDump, safariRedirectScript);
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      tick().catch(() => {});
    }, intervalMs);
    tick().catch(() => {});
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { start, stop, tick, parseTabDump };
}

module.exports = { startWatchdog, parseTabDump, parseHost, runOsa };
