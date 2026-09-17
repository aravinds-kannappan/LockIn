"use strict";

const path = require("path");
const { enableLoginItem, launchAgentPath } = require("../desktop/login");

const repoRoot = path.join(__dirname, "..");

enableLoginItem(repoRoot)
  .then((result) => {
    console.log("LockIn login item installed.");
    console.log(`LaunchAgent: ${result.plistPath || launchAgentPath()}`);
    console.log("Warden will open at login on this Mac.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
