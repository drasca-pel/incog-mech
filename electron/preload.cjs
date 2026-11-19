// The safe bridge between the app window and the computer.
// The window can only call the few functions listed here. It never gets direct access to files.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspace: (json) => ipcRenderer.invoke("workspace:save", json),
  saveWorkspaceSync: (json) => ipcRenderer.sendSync("workspace:saveSync", json),
  saveProject: (file, json) => ipcRenderer.invoke("project:save", file, json),
  saveProjectAs: (name, json) => ipcRenderer.invoke("project:saveAs", name, json),
  openProject: () => ipcRenderer.invoke("project:open"),
  // Messages about updates ("Update found", "Update ready"). Returns a function that stops listening.
  onUpdate: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on("update:status", handler);
    return () => ipcRenderer.removeListener("update:status", handler);
  },
});