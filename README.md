# LockIn

A focus lock for this Mac. Name one task. The desktop is covered. If you open a **real** Chrome or Safari tab to YouTube, X, Instagram, Reddit, or the rest of the blocklist, that navigation is killed. Done is a written debrief. Warden, the local agent, grades it — and remembers how you work.

This is a native macOS app (Electron). It is not an in-app fake browser.

Verified with **Node v22.23.2** and **npm 10.9.8** on macOS.

## Clone, install, start

```bash
git clone git@github.com:aravinds-kannappan/LockIn.git
cd LockIn
npm install
npm start
```

`npm start` opens the LockIn overlay immediately (always-on-top, every Space). That is the agent UI. It also starts a local control server on `127.0.0.1:18791` and a blocking proxy on `127.0.0.1:18792`.

## Open Warden at login

From the setup screen, leave **Open Warden at login / when this computer starts** checked, or:

```bash
npm run install-login
```

That writes `~/Library/LaunchAgents/ai.lockin.agent.plist` and loads it. At login, LockIn pops up — no extra click.

To remove it: uncheck the box in the UI, or `launchctl unload ~/Library/LaunchAgents/ai.lockin.agent.plist`.

## Real site blocking (no reboot)

Blocks apply **only while a lock is sealed**. Unlocking turns them off. You do not reboot.

Three layers, all local:

1. **Chrome / Safari watchdog** — while locked, LockIn reads real tab URLs and redirects blocked tabs to `http://127.0.0.1:18791/blocked`. First run, macOS may ask to allow Automation for Google Chrome and Safari. Allow it.
2. **Chrome extension** (faster, no YouTube flash) — Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → select the `extension/` folder in this repo. The extension polls lock state and uses `declarativeNetRequest` so `youtube.com` never paints.
3. **System PAC + proxy** — LockIn tries `networksetup -setautoproxyurl` so Chrome and Safari send blocked hosts to `127.0.0.1:18792`, which returns `403` on `CONNECT youtube.com:443`. If macOS denies PAC without an admin password, layers 1–2 still stop the tab. PAC is cleared when the lock ends.

Allowed work (GitHub, docs, etc.) is not proxied.

## Prove a real YouTube tab is blocked

With LockIn running and a session sealed (`npm start`, then **Lock this machine**):

```bash
# HTTPS CONNECT through the lock proxy — this is what a browser hits for youtube.com
npm run prove
```

That script seals a lock itself and asserts `CONNECT youtube.com:443` returns `403 LockIn blocked YouTube`.

Manual Chrome proof:

```bash
npm start          # then lock a task in the overlay
npm run prove:chrome
```

`prove:chrome` opens a real Chrome profile with the LockIn extension loaded and navigates to `https://www.youtube.com`. You should land on the LockIn block page (extension or watchdog) or a failed tunnel (PAC). The overlay's **Live blocks** list should show YouTube.

Or by hand: new Chrome/Safari tab → `https://www.youtube.com` while locked.

## Learning (local, no cloud)

Memory lives at:

```text
~/Library/Application Support/LockIn/memory.json
```

Warden stores tasks, debriefs, blocked hosts, and escape attempts. The next setup screen greets you with that. Abandoned tasks get suggested again. After a sloppy lock (escapes / lots of blocks), debriefs get a stricter read.

## Session rules

- **Done** requires a written debrief. Generic “I did the work” is rejected.
- **Break lock** / Esc / Cmd+Q while locked is a gauntlet: type `I QUIT`, wait, confirm. Abandoned sessions are stored as broken.
- Quitting the app while locked does not skip the gauntlet.

## Checks

```bash
npm test
npm run prove
```

## Stack

Electron (macOS overlay + login item) + a localhost PAC/proxy + a Chrome MV3 extension + AppleScript tab watchdog. Session memory is a JSON file on disk. No auth, no cloud database.
