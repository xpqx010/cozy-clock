const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cozyClock", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  hasBattery: () => ipcRenderer.invoke("battery:available"),
  notify: (title, body) => ipcRenderer.send("notification:show", title, body),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  getWallpaper: () => ipcRenderer.invoke("wallpaper:get"),
  importWallpaper: () => ipcRenderer.invoke("wallpaper:import"),
  removeWallpaper: () => ipcRenderer.invoke("wallpaper:remove"),
  listPresets: () => ipcRenderer.invoke("presets:list"),
  savePreset: (name) => ipcRenderer.invoke("presets:save", name),
  applyPreset: (presetId) => ipcRenderer.invoke("presets:apply", presetId),
  removePreset: (presetId) => ipcRenderer.invoke("presets:remove", presetId),
  listMusic: () => ipcRenderer.invoke("music:list"),
  importMusic: () => ipcRenderer.invoke("music:import"),
  importYouTube: (url) => ipcRenderer.invoke("music:youtube", url),
  removeMusic: (trackId) => ipcRenderer.invoke("music:remove", trackId),
  setCustomizationMode: (enabled) => ipcRenderer.invoke("window:customize", enabled),
  resizeStep: (direction) => ipcRenderer.invoke("window:resize-step", direction),
  toggleHud: () => ipcRenderer.send("hud:toggle"),
  setWindowSize: (sizeName) => ipcRenderer.invoke("window:size-preset", sizeName),
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close")
});
