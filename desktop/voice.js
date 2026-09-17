"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");

const CARTESIA_API = "https://api.cartesia.ai/tts/bytes";
const CARTESIA_VERSION = "2024-06-10";
const MODEL = "sonic-2";
const VOICE_ID = "694f9389-aac1-45b6-b726-9d9369183238";

function loadApiKey() {
  const envPath = path.join(__dirname, "..", ".env");
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    const match = raw.match(/^CARTESIA_API_KEY=(.+)$/m);
    return match ? match[1].trim() : process.env.CARTESIA_API_KEY || "";
  } catch {
    return process.env.CARTESIA_API_KEY || "";
  }
}

function speak(text) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("No Cartesia API key"));
  }

  const body = JSON.stringify({
    model_id: MODEL,
    transcript: String(text),
    voice: { mode: "id", id: VOICE_ID },
    output_format: {
      container: "raw",
      encoding: "pcm_f32le",
      sample_rate: 24000,
    },
  });

  return new Promise((resolve, reject) => {
    const url = new URL(CARTESIA_API);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "Cartesia-Version": CARTESIA_VERSION,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Cartesia ${res.statusCode}: ${Buffer.concat(chunks).toString("utf8").slice(0, 200)}`));
            return;
          }
          const pcm = Buffer.concat(chunks);
          const floats = new Float32Array(
            pcm.buffer,
            pcm.byteOffset,
            pcm.byteLength / 4,
          );
          resolve({ sampleRate: 24000, samples: Array.from(floats) });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Cartesia timeout"));
    });
    req.end(body);
  });
}

function hasApiKey() {
  return Boolean(loadApiKey());
}

module.exports = { speak, hasApiKey };
