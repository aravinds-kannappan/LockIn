"use strict";

const path = require("path");
const { app, BrowserWindow, ipcMain, screen, globalShortcut, Tray, Menu, nativeImage } = require("electron");
const { createEngine } = require("./engine");
const { enableLoginItem, disableLoginItem } = require("./login");

const REPO_ROOT = path.join(__dirname, "..");

let mainWindow = null;
let engine = null;
let tray = null;

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 400;
  const winH = 640;
  const win = new BrowserWindow({
    x: Math.round(width - winW - 24),
    y: Math.round((height - winH) / 2),
    width: winW,
    height: winH,
    minWidth: 360,
    minHeight: 480,
    frame: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    resizable: true,
    minimizable: true,
    maximizable: false,
    alwaysOnTop: true,
    backgroundColor: "#0a0a0c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  return win;
}

function showAndFocus() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function broadcast(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("lockin:state", state);
  }
}

function updateTrayMenu() {
  if (!tray || !engine) return;
  const state = engine.getPublic();
  const items = [];
  if (state.locked) {
    const taskLabel = state.task.length > 32 ? state.task.slice(0, 32) + "…" : state.task;
    items.push({ label: `Locked: ${taskLabel}`, enabled: false });
    items.push({ label: "End Session", click: () => engine.endSession("") });
  } else {
    items.push({ label: "Lock In", click: () => { engine.quickLock(); showAndFocus(); } });
  }
  items.push({ type: "separator" });
  items.push({ label: "Show Window", accelerator: "CmdOrCtrl+Shift+L", click: showAndFocus });
  items.push({ type: "separator" });
  items.push({ label: "Quit", click: () => app.quit() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(state.locked ? `LockIn — ${state.task}` : "LockIn");
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "assets", "trayTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.on("click", showAndFocus);
  updateTrayMenu();
}

function handleProtocolUrl(url) {
  if (!engine) return;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    showAndFocus();
    return;
  }
  const action = parsed.host || parsed.pathname.replace(/^\//, "");
  if (action === "start" || action === "lock") {
    if (!engine.getPublic().locked) engine.quickLock();
    showAndFocus();
  } else if (action === "stop" || action === "end") {
    if (engine.getPublic().locked) engine.endSession("");
  } else {
    showAndFocus();
  }
}

async function syncLoginItem(enabled) {
  if (app.setLoginItemSettings) {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
      path: process.execPath,
      args: app.isPackaged ? [] : [REPO_ROOT],
    });
  }
  if (enabled) await enableLoginItem(REPO_ROOT);
  else await disableLoginItem();
}

app.setAsDefaultProtocolClient("lockin");
app.setName("LockIn");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    showAndFocus();
    const urlArg = argv.find((a) => a.startsWith("lockin://"));
    if (urlArg) handleProtocolUrl(urlArg);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  app.whenReady().then(async () => {
    engine = createEngine();
    await engine.start();
    mainWindow = createMainWindow();
    createTray();

    engine.on("change", (state) => {
      broadcast(state);
      updateTrayMenu();
    });

    if (engine.getPublic().loginItemEnabled && process.env.LOCKIN_SKIP_LOGIN !== "1") {
      await syncLoginItem(true);
    }

    globalShortcut.register("CommandOrControl+Shift+L", showAndFocus);

    ipcMain.handle("lockin:state", () => engine.getPublic());
    ipcMain.handle("lockin:lock", async (_e, task) => engine.lock(task));
    ipcMain.handle("lockin:quick-lock", async () => engine.quickLock());
    ipcMain.handle("lockin:suggest", () => engine.suggest());
    ipcMain.handle("lockin:notes", (_e, notes) => {
      engine.setNotes(notes);
      return true;
    });
    ipcMain.handle("lockin:end-session", async (_e, note) => engine.endSession(note));
    ipcMain.handle("lockin:reset", () => {
      engine.reset();
      return engine.getPublic();
    });
    ipcMain.handle("lockin:login-item", async (_e, enabled) => {
      const next = engine.setLoginItemEnabled(enabled);
      await syncLoginItem(next);
      return engine.getPublic();
    });
  });

  app.on("before-quit", () => {
    globalShortcut.unregisterAll();
    if (engine) engine.disableBlocks().catch(() => {});
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", showAndFocus);
}
