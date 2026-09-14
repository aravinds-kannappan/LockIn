# LockIn

A focus lock that actually forces you to stay on one task — not a polite site blocker.

Name one task. The machine goes into a full-screen lock: the desk is notes + a timer, the fake browser refuses YouTube, X, Instagram, Reddit, and the rest, and quitting takes friction (type `I QUIT`, wait, confirm). Done is not a click. You write what you did. Warden, the in-app agent, accepts a real debrief or sends you back.

This repo is a clickable Next.js demo. No auth, no database, no Chrome extension.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43211](http://127.0.0.1:43211). The dev server binds to `0.0.0.0:43211` so it is reachable from the preview.

```bash
npm run build
npm run start -- --hostname 0.0.0.0 --port 43211
```

## Demo flow

1. Pick a sample lock (or let the agent pick), then **Lock this machine**.
2. While locked, open YouTube / X / Instagram / Reddit in the in-app browser — they are refused and counted.
3. **Break lock** is a gauntlet, not an exit. **Esc** opens the same gauntlet.
4. **Done** requires a written debrief. A one-liner that does not mention the task is rejected.
5. Recap shows time locked, blocked-site attempts, and escape tries.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Session state lives in the client for this slice.
