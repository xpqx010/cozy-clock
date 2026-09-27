const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cozyClock", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  getWallpaper: () => ipcRenderer.invoke("wallpaper:get"),
  importWallpaper: () => ipcRenderer.invoke("wallpaper:import"),
  removeWallpaper: () => ipcRenderer.invoke("wallpaper:remove"),
  listMusic: () => ipcRenderer.invoke("music:list"),
  importMusic: () => ipcRenderer.invoke("music:import"),
  importYouTube: (url) => ipcRenderer.invoke("music:youtube", url),
  removeMusic: (trackId) => ipcRenderer.invoke("music:remove", trackId),
  setCustomizationMode: (enabled) => ipcRenderer.invoke("window:customize", enabled),
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close")
});
