"use strict";

const http = require("http");
const { matchBlocked, pacHostList } = require("../shared/sites");

function buildPac(getState) {
  return `function FindProxyForURL(url, host) {
  host = (host || "").toLowerCase();
  if (host === "127.0.0.1" || host === "localhost") return "DIRECT";
  var locked = ${getState().locked ? "true" : "false"};
  if (!locked) return "DIRECT";
  var blocked = ${JSON.stringify(pacHostList(getState().extraHosts || []))};
  for (var i = 0; i < blocked.length; i++) {
    var b = blocked[i];
    if (host === b || dnsDomainIs(host, b) || shExpMatch(host, "*." + b)) {
      return "PROXY 127.0.0.1:${getState().proxyPort}";
    }
  }
  return "DIRECT";
}
`;
}

function blockPage({ site, task, host }) {
  const label = site || host || "this site";
  const lockedTask = task || "the locked task";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LockIn blocked ${label}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #09090b; color: #fafafa;
    }
    main { max-width: 36rem; padding: 2rem; }
    .kicker {
      font-family: ui-monospace, Menlo, monospace;
      letter-spacing: .22em; text-transform: uppercase;
      font-size: 11px; color: #f59e0b;
    }
    h1 { font-size: 2rem; margin: .6rem 0 0; }
    p { color: #a1a1aa; line-height: 1.6; }
    .task { color: #e4e4e7; }
  </style>
</head>
<body>
  <main>
    <p class="kicker">LockIn · blocked</p>
    <h1>Nope — ${escapeHtml(label)} is off limits right now.</h1>
    <p>You're locked in. This site is blocked until your session ends. Get back to it.</p>
    <p class="task">Current task: ${escapeHtml(lockedTask)}</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function startProxy(port, getState, onBlocked) {
  const server = http.createServer((req, res) => {
    const host = req.headers.host || "";
    const match = getState().locked ? matchBlocked(host, getState().extraHosts) : null;
    if (match) {
      onBlocked?.(match, `http://${host}${req.url || "/"}`);
      res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
      res.end(blockPage({ site: match.name, host: match.host, task: getState().task }));
      return;
    }
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("LockIn proxy only handles blocked hosts.\n");
  });

  server.on("connect", (req, socket) => {
    const host = (req.url || "").split(":")[0];
    const match = getState().locked ? matchBlocked(host, getState().extraHosts) : null;
    if (match) {
      onBlocked?.(match, `https://${host}`);
      socket.write(
        "HTTP/1.1 403 Forbidden\r\n" +
          "Content-Type: text/plain\r\n" +
          "Connection: close\r\n" +
          "\r\n" +
          `LockIn blocked ${match.name}\n`,
      );
      socket.end();
      return;
    }
    socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    socket.end();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

module.exports = { buildPac, blockPage, startProxy, escapeHtml };
