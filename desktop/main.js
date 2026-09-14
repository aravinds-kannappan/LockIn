"use strict";

const path = require("path");
const { app, BrowserWindow, ipcMain, screen, globalShortcut } = require("electron");
const { createEngine } = require("./engine");
const { enableLoginItem, disableLoginItem } = require("./login");

const REPO_ROOT = path.join(__dirname, "..");

let mainWindow = null;
let coverWindows = [];
let engine = null;
let quitting = false;

function coverDisplays(primaryId) {
  for (const win of coverWindows) {
    if (!win.isDestroyed()) win.close();
  }
  coverWindows = [];
  for (const display of screen.getAllDisplays()) {
    if (display.id === primaryId) continue;
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      closable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: "#09090b",
      show: true,
    });
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, "floating");
    win.loadFile(path.join(__dirname, "..", "renderer", "cover.html"));
    coverWindows.push(win);
  }
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    closable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    simpleFullscreen: true,
    alwaysOnTop: true,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, "floating");
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  coverDisplays(display.id);
  return win;
}

function broadcast(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("lockin:state", state);
  }
}

function applyLockChrome(locked) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setAlwaysOnTop(true, locked ? "screen-saver" : "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setKiosk(false);
  if (locked) {
    mainWindow.setClosable(false);
    mainWindow.show();
    mainWindow.moveTop();
    mainWindow.focus();
  } else {
    mainWindow.setClosable(true);
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

app.setName("LockIn");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    engine = createEngine();
    await engine.start();
    mainWindow = createMainWindow();

    engine.on("change", (state) => {
      applyLockChrome(state.locked);
      broadcast(state);
    });

    if (engine.getPublic().loginItemEnabled) {
      await syncLoginItem(true);
    }

    globalShortcut.register("Escape", () => {
      const state = engine.getPublic();
      if (state.locked) {
        engine.beginEscape();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("lockin:escape");
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    ipcMain.handle("lockin:state", () => engine.getPublic());
    ipcMain.handle("lockin:lock", async (_e, task) => engine.lock(task));
    ipcMain.handle("lockin:suggest", () => engine.suggest());
    ipcMain.handle("lockin:notes", (_e, notes) => {
      engine.setNotes(notes);
      return true;
    });
    ipcMain.handle("lockin:begin-done", () => {
      engine.beginDone();
      return engine.getPublic();
    });
    ipcMain.handle("lockin:debrief", (_e, text) => engine.submitDebrief(text));
    ipcMain.handle("lockin:begin-escape", () => engine.beginEscape());
    ipcMain.handle("lockin:stay", () => engine.getPublic());
    ipcMain.handle("lockin:abandon", () => engine.abandon());
    ipcMain.handle("lockin:reset", () => {
      engine.reset();
      return engine.getPublic();
    });
    ipcMain.handle("lockin:login-item", async (_e, enabled) => {
      const next = engine.setLoginItemEnabled(enabled);
      await syncLoginItem(next);
      return engine.getPublic();
    });

    mainWindow.on("close", (event) => {
      const state = engine.getPublic();
      if (state.locked && !quitting) {
        event.preventDefault();
        engine.beginEscape();
        mainWindow.webContents.send("lockin:escape");
      }
    });

    screen.on("display-added", () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        coverDisplays(screen.getPrimaryDisplay().id);
      }
    });
  });

  app.on("before-quit", (event) => {
    const state = engine ? engine.getPublic() : { locked: false };
    if (state.locked && !quitting) {
      event.preventDefault();
      engine.beginEscape();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.webContents.send("lockin:escape");
      }
      return;
    }
    quitting = true;
    globalShortcut.unregisterAll();
    if (engine) engine.disableBlocks().catch(() => {});
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      mainWindow = createMainWindow();
    }
  });
}
