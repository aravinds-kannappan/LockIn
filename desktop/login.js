"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const LABEL = "ai.lockin.agent";

function plistContents(execPath, args) {
  const argXml = args
    .map((arg) => `    <string>${escapeXml(arg)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProgramArguments</key>
  <array>
${argXml}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(path.dirname(args[args.length - 1] === "." ? execPath : args[0]))}</string>
</dict>
</plist>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function launchAgentPath() {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

function launchArgs(repoRoot) {
  const electronBin = path.join(repoRoot, "node_modules", ".bin", "electron");
  return {
    execPath: electronBin,
    args: [electronBin, repoRoot],
  };
}

function writeLaunchAgent(repoRoot) {
  const { execPath, args } = launchArgs(repoRoot);
  const plistPath = launchAgentPath();
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  const workingDir = repoRoot;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(execPath)}</string>
    <string>${escapeXml(repoRoot)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(workingDir)}</string>
  <key>StandardOutPath</key>
  <string>${escapeXml(path.join(os.homedir(), "Library", "Logs", "LockIn.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(path.join(os.homedir(), "Library", "Logs", "LockIn.err.log"))}</string>
</dict>
</plist>
`;
  fs.writeFileSync(plistPath, body);
  return { plistPath, execPath, args };
}

function bootctl(args) {
  return new Promise((resolve) => {
    execFile("launchctl", args, { timeout: 8000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ""),
        stderr: String(stderr || ""),
      });
    });
  });
}

async function enableLoginItem(repoRoot) {
  const { plistPath } = writeLaunchAgent(repoRoot);
  await bootctl(["unload", plistPath]);
  const loaded = await bootctl(["load", plistPath]);
  const uid = process.getuid?.() ?? 501;
  await bootctl(["bootstrap", `gui/${uid}`, plistPath]);
  await bootctl(["enable", `gui/${uid}/${LABEL}`]);
  return { plistPath, loaded };
}

async function disableLoginItem() {
  const plistPath = launchAgentPath();
  const uid = process.getuid?.() ?? 501;
  await bootctl(["bootout", `gui/${uid}/${LABEL}`]);
  await bootctl(["unload", plistPath]);
  if (fs.existsSync(plistPath)) fs.unlinkSync(plistPath);
  return { plistPath };
}

module.exports = {
  LABEL,
  launchAgentPath,
  writeLaunchAgent,
  enableLoginItem,
  disableLoginItem,
  plistContents,
};
