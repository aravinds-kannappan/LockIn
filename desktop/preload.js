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
  addChecklistItem: (text) => ipcRenderer.invoke("lockin:checklist-add", text),
  toggleChecklistItem: (id) => ipcRenderer.invoke("lockin:checklist-toggle", id),
  removeChecklistItem: (id) => ipcRenderer.invoke("lockin:checklist-remove", id),
  setNotes: (notes) => ipcRenderer.invoke("lockin:notes", notes),
  endSession: (note) => ipcRenderer.invoke("lockin:end-session", note),
  reset: () => ipcRenderer.invoke("lockin:reset"),
  setLoginItem: (enabled) => ipcRenderer.invoke("lockin:login-item", enabled),
  speak: (text) => ipcRenderer.invoke("lockin:speak", text),
  voiceAvailable: () => ipcRenderer.invoke("lockin:voice-available"),
});
