"use strict";

const http = require("http");
const net = require("net");
const path = require("path");
const os = require("os");
const { createEngine } = require("../desktop/engine");

async function connectYoutube(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      socket.write("CONNECT youtube.com:443 HTTP/1.1\r\nHost: youtube.com:443\r\n\r\n");
    });
    socket.setTimeout(4000);
    const chunks = [];
    socket.on("data", (chunk) => {
      chunks.push(chunk);
      socket.end();
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("CONNECT timeout"));
    });
    socket.on("error", reject);
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
        );
      })
      .on("error", reject);
  });
}

async function waitForLock(engine, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (engine.getPublic().locked) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("engine did not lock");
}

async function main() {
  process.env.LOCKIN_SKIP_PAC = process.env.LOCKIN_SKIP_PAC || "1";
  process.env.LOCKIN_SKIP_WATCHDOG = process.env.LOCKIN_SKIP_WATCHDOG || "1";
  const memoryPath = path.join(os.tmpdir(), `lockin-prove-${Date.now()}.json`);
  const engine = createEngine({
    memoryPath,
    apiPort: Number(process.env.LOCKIN_API_PORT || 19791),
    proxyPort: Number(process.env.LOCKIN_PROXY_PORT || 19792),
  });
  await engine.start();
  const result = await engine.lock(
    "Write the first 800 words of the LockIn landing page",
  );
  if (!result.ok) throw new Error(result.error);
  await waitForLock(engine);
  const proxyBody = await connectYoutube(engine.proxyPort);
  if (!proxyBody.includes("403") || !proxyBody.includes("YouTube")) {
    throw new Error(`expected 403 YouTube block, got:\n${proxyBody}`);
  }
  const page = await get(
    `http://127.0.0.1:${engine.apiPort}/blocked?site=YouTube&host=youtube.com`,
  );
  if (page.status !== 200 || !page.body.includes("YouTube is off limits")) {
    throw new Error("block page missing");
  }
  const pac = await get(`http://127.0.0.1:${engine.apiPort}/lockin.pac`);
  if (!pac.body.includes("PROXY 127.0.0.1") || !pac.body.includes("youtube.com")) {
    throw new Error("PAC missing youtube rule");
  }
  console.log("LOCKIN_PROOF_OK");
  console.log(`proxy_connect_youtube=${proxyBody.split("\r\n")[0]}`);
  console.log(`block_page_status=${page.status}`);
  console.log("pac_locked=true");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
