"use strict";

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const chrome =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const repo = path.join(__dirname, "..");
const extension = path.join(repo, "extension");
const profile = path.join(os.tmpdir(), "lockin-chrome-proof-profile");
fs.mkdirSync(profile, { recursive: true });

const url = process.argv[2] || "https://www.youtube.com";
const child = spawn(
  chrome,
  [
    `--user-data-dir=${profile}`,
    `--load-extension=${extension}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    `--proxy-pac-url=http://127.0.0.1:18791/lockin.pac`,
    url,
  ],
  { detached: true, stdio: "ignore" },
);
child.unref();
console.log(`Opened Chrome at ${url} with the LockIn extension and PAC.`);
console.log("If a lock is sealed, this tab should hit the LockIn block page.");
