# LockIn

A focus agent that blocks social media in your browser while you work. It pops up as a compact floating window — your computer stays unlocked, but YouTube, X, Instagram, Reddit, TikTok, Facebook, Netflix, Twitch, Discord, and Hacker News tabs get killed in Chrome and Safari.

Warden, the local agent, remembers your sessions — tasks, blocked sites, and how you work. No cloud, no account.

Verified with **Node v22.23.2** and **npm 10.9.8** on macOS.

## Clone, install, start

```bash
git clone git@github.com:aravinds-kannappan/LockIn.git
cd LockIn
npm install
npm start
```

`npm start` opens the LockIn popup (always-on-top, floating). Name a task, hit **Lock In**, and social media tabs die in real Chrome and Safari until you end the session.

## How blocking works

Blocks apply **only while a session is active**. Ending the session turns them off. Three layers, all local:

1. **Chrome / Safari watchdog** — reads real tab URLs via AppleScript and redirects blocked tabs to a local block page. First run, macOS may ask to allow Automation for Google Chrome and Safari.
2. **Chrome extension** (faster, no flash) — Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select the `extension/` folder. Uses `declarativeNetRequest` so blocked sites never paint.
3. **System PAC + proxy** — sets a PAC file via `networksetup` so Chrome and Safari route blocked hosts to a local proxy that returns `403`. If macOS denies PAC without an admin password, layers 1–2 still work.

Allowed sites (GitHub, docs, etc.) are never proxied.

## Summon the agent

Three ways to call LockIn:

1. **Keyboard shortcut** — `Cmd+Shift+L` (global, works from any app) shows the LockIn window.
2. **Menu bar** — Click the **L** tray icon in the menu bar for quick actions: start a session, end one, or show the window.
3. **Siri / Shortcuts** — LockIn registers the `lockin://` URL scheme. Create a Shortcut that opens `lockin://start` and name it "Lock In" — then say **"Hey Siri, Lock In"** to start a focus session.

URL scheme commands:
- `lockin://start` — start a session (uses your last task)
- `lockin://stop` — end the current session
- `lockin://open` — show the window

## Open at login

From the setup screen, check **Open at login**, or:

```bash
npm run install-login
```

To remove: uncheck the box, or `launchctl unload ~/Library/LaunchAgents/ai.lockin.agent.plist`.

## Prove blocking works

With LockIn running and a session active:

```bash
npm run prove
```

Or load the Chrome extension and navigate to `https://www.youtube.com` — the tab gets killed.

## Learning

Memory lives at `~/Library/Application Support/LockIn/memory.json`. Warden stores tasks, blocked hosts, and session history. Frequently blocked hosts get added to the blocklist automatically.

## Checks

```bash
npm test
npm run prove
```

## Stack

Electron (macOS floating popup + login item) + localhost PAC/proxy + Chrome MV3 extension + AppleScript tab watchdog. Session memory is a JSON file on disk. No auth, no cloud.
