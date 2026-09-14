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
  suggest: () => ipcRenderer.invoke("lockin:suggest"),
  setNotes: (notes) => ipcRenderer.invoke("lockin:notes", notes),
  beginDone: () => ipcRenderer.invoke("lockin:begin-done"),
  submitDebrief: (text) => ipcRenderer.invoke("lockin:debrief", text),
  beginEscape: () => ipcRenderer.invoke("lockin:begin-escape"),
  stay: () => ipcRenderer.invoke("lockin:stay"),
  abandon: () => ipcRenderer.invoke("lockin:abandon"),
  reset: () => ipcRenderer.invoke("lockin:reset"),
  setLoginItem: (enabled) => ipcRenderer.invoke("lockin:login-item", enabled),
  onEscape: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("lockin:escape", listener);
    return () => ipcRenderer.removeListener("lockin:escape", listener);
  },
});
