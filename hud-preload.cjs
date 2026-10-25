const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cozyHud", {
  moveBy: (deltaX, deltaY) => ipcRenderer.send("hud:move-by", deltaX, deltaY),
  resizeFromWheel: (direction) => ipcRenderer.send("hud:resize-wheel", direction),
  close: () => ipcRenderer.send("hud:close")
});
