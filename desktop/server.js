"use strict";

const http = require("http");
const { URL } = require("url");
const { execFile } = require("child_process");
const { buildPac, blockPage, startProxy } = require("./blocker");
const { matchBlocked, pacHostList } = require("../shared/sites");

const DEFAULT_API_PORT = 18791;
const DEFAULT_PROXY_PORT = 18792;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function listNetworkServices() {
  return new Promise((resolve) => {
    execFile("networksetup", ["-listallnetworkservices"], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      const lines = String(stdout || "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("An asterisk"));
      resolve(lines.filter((l) => !l.startsWith("*")));
    });
  });
}

function netsetup(args) {
  return new Promise((resolve) => {
    execFile("networksetup", args, { timeout: 8000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim(),
      });
    });
  });
}

async function setSystemPac(pacUrl, enabled) {
  const services = await listNetworkServices();
  const results = [];
  for (const service of services) {
    if (enabled) {
      const setUrl = await netsetup(["-setautoproxyurl", service, pacUrl]);
      const setOn = await netsetup(["-setautoproxystate", service, "on"]);
      results.push({ service, setUrl, setOn });
    } else {
      const setOff = await netsetup(["-setautoproxystate", service, "off"]);
      results.push({ service, setOff });
    }
  }
  return results;
}

function startControlServer({ port, proxyPort, getState, onBlocked }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/state") {
      json(res, 200, publicState(getState()));
      return;
    }

    if (req.method === "GET" && (url.pathname === "/lockin.pac" || url.pathname === "/proxy.pac")) {
      const pac = buildPac(() => ({ ...getState(), proxyPort }));
      res.writeHead(200, {
        "Content-Type": "application/x-ns-proxy-autoconfig",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      });
      res.end(pac);
      return;
    }

    if (req.method === "GET" && (url.pathname === "/blocked" || url.pathname === "/blocked.html")) {
      const site = url.searchParams.get("site") || url.searchParams.get("name") || "";
      const host = url.searchParams.get("host") || "";
      const html = blockPage({
        site: site || host || "this site",
        host,
        task: getState().task,
      });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && url.pathname === "/blocked") {
      const body = await readBody(req);
      const match =
        matchBlocked(body.url || body.host || "", getState().extraHosts) ||
        (body.host || body.name
          ? { host: body.host || body.name, name: body.name || body.host }
          : null);
      if (match && getState().locked) {
        onBlocked?.(match, body.url || match.host);
      }
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, locked: getState().locked });
      return;
    }

    json(res, 404, { error: "not found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function publicState(state) {
  return {
    locked: Boolean(state.locked),
    phase: state.phase,
    task: state.task,
    startedAt: state.startedAt,
    blockedHosts: pacHostList(state.extraHosts || []),
    extraHosts: state.extraHosts || [],
    blockedAttempts: (state.blockedEvents || []).length,
    escapeAttempts: state.escapeAttempts || 0,
    proxyPort: state.proxyPort,
    apiPort: state.apiPort,
  };
}

module.exports = {
  DEFAULT_API_PORT,
  DEFAULT_PROXY_PORT,
  startControlServer,
  startProxy,
  setSystemPac,
  publicState,
};
