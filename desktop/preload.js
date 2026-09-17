"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lockin", {
  getState: () => ipcRenderer.invoke("lockin:state"),
  onState: (cb) => {
    const listener = (_event, state) => cb(state);
    ipcRenderer.on("lockin:state", listener);
    return () => ipcRenderer.removeListener("lockin:state", listener);
  },
  lock: (task) => ipcRenderer.invoke("lockin:lock", task),
  quickLock: () => ipcRenderer.invoke("lockin:quick-lock"),
  suggest: () => ipcRenderer.invoke("lockin:suggest"),
  setNotes: (notes) => ipcRenderer.invoke("lockin:notes", notes),
  endSession: (note) => ipcRenderer.invoke("lockin:end-session", note),
  reset: () => ipcRenderer.invoke("lockin:reset"),
  setLoginItem: (enabled) => ipcRenderer.invoke("lockin:login-item", enabled),
});
