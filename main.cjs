const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Notification, screen } = require("electron");
const { execFile } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const youtubeDlPackage = require("youtube-dl-exec");
const youtubeDl = app.isPackaged
  ? youtubeDlPackage.create(path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      "youtube-dl-exec",
      "bin",
      "yt-dlp.exe"
    ))
  : youtubeDlPackage;

let mainWindow;
let saveTimer;
let compactBounds;
let isCustomizing = false;
let hudWindow;
let hudSaveTimer;

const defaults = {
  alwaysOnTop: true,
  hour24: false,
  showSeconds: false,
  showDate: true,
  theme: "ember",
  clockFont: "rounded",
  clockPanels: "full",
  clockColor: "#ed795f",
  wallpaperDim: 45,
  windowSize: "medium",
  weatherLocation: null,
  weatherUnit: "celsius",
  elementPositions: {},
  pomodoroWork: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroSessions: 4,
  pomodoroState: { mode: "focus", running: false, remaining: 1500, endAt: null, completed: 0 },
  hudColor: null,
  hudOpacity: 100,
  hudBounds: null
};
const windowSizes = {
  small: { width: 320, height: 190 },
  medium: { width: 380, height: 220 },
  large: { width: 500, height: 290 }
};
const previewTheme = process.argv.find((argument) => argument.startsWith("--preview-theme="))?.split("=")[1];

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function libraryPath() {
  return path.join(app.getPath("userData"), "music-library.json");
}

function mediaDirectory() {
  return path.join(app.getPath("userData"), "music");
}

function wallpaperDirectory() {
  return path.join(app.getPath("userData"), "wallpaper");
}

function currentWallpaperPath() {
  try {
    const fileName = fs.readdirSync(wallpaperDirectory()).find((name) => name.startsWith("custom."));
    return fileName ? path.join(wallpaperDirectory(), fileName) : null;
  } catch {
    return null;
  }
}

function currentWallpaper() {
  const filePath = currentWallpaperPath();
  return filePath
    ? { url: pathToFileURL(filePath).href, animated: path.extname(filePath).toLowerCase() === ".gif" }
    : null;
}

function presetsDirectory() {
  return path.join(app.getPath("userData"), "presets");
}

function presetsPath() {
  return path.join(app.getPath("userData"), "custom-themes.json");
}

function readPresets() {
  try {
    const presets = JSON.parse(fs.readFileSync(presetsPath(), "utf8"));
    return Array.isArray(presets) ? presets : [];
  } catch {
    return [];
  }
}

function publicPresets() {
  return readPresets().map(({ wallpaperPath, ...preset }) => ({
    ...preset,
    wallpaperUrl: wallpaperPath && fs.existsSync(wallpaperPath) ? pathToFileURL(wallpaperPath).href : null,
    animated: path.extname(wallpaperPath || "").toLowerCase() === ".gif"
  }));
}

function clearCurrentWallpaper() {
  try {
    for (const fileName of fs.readdirSync(wallpaperDirectory())) {
      if (fileName.startsWith("custom.")) fs.unlinkSync(path.join(wallpaperDirectory(), fileName));
    }
  } catch {}
}

function hasSystemBattery() {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", "@(Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue).Count"],
      { timeout: 5000, windowsHide: true },
      (error, stdout) => resolve(!error && Number.parseInt(stdout.trim(), 10) > 0)
    );
  });
}

function readLibrary() {
  try {
    const tracks = JSON.parse(fs.readFileSync(libraryPath(), "utf8"));
    return Array.isArray(tracks) ? tracks.filter((track) => fs.existsSync(track.filePath)) : [];
  } catch {
    return [];
  }
}

function publicTracks() {
  return readLibrary().map(({ id, title, filePath }) => ({
    id,
    title,
    url: pathToFileURL(filePath).href
  }));
}

function isYouTubeUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return parsed.protocol === "https:" && ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host);
  } catch {
    return false;
  }
}

function readSettings() {
  try {
    const saved = { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath(), "utf8")) };
    return previewTheme ? { ...saved, theme: previewTheme } : saved;
  } catch {
    return previewTheme ? { ...defaults, theme: previewTheme } : { ...defaults };
  }
}

function writeSettings(next) {
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}

function boundsAreVisible(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return false;
  return screen.getAllDisplays().some(({ workArea }) => (
    bounds.x < workArea.x + workArea.width
    && bounds.x + 80 > workArea.x
    && bounds.y < workArea.y + workArea.height
    && bounds.y + 80 > workArea.y
  ));
}

function clampBoundsToWorkArea(bounds) {
  const primaryArea = screen.getPrimaryDisplay().workArea;
  const probe = {
    x: Number.isFinite(bounds.x) ? bounds.x : primaryArea.x + primaryArea.width - (bounds.width || 380) - 24,
    y: Number.isFinite(bounds.y) ? bounds.y : primaryArea.y + 24,
    width: bounds.width || 380,
    height: bounds.height || 220
  };
  const { workArea } = screen.getDisplayMatching(probe);
  const width = Math.min(Math.max(bounds.width || 380, 300), Math.min(900, workArea.width));
  const height = Math.min(Math.max(bounds.height || 220, 180), Math.min(500, workArea.height));
  return {
    x: Math.max(workArea.x, Math.min(probe.x, workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(probe.y, workArea.y + workArea.height - height)),
    width,
    height
  };
}

function createWindow() {
  const settings = readSettings();
  const savedBounds = settings.bounds;
  const requestedBounds = boundsAreVisible(savedBounds)
    ? savedBounds
    : { width: 380, height: 220 };
  const bounds = clampBoundsToWorkArea(requestedBounds);

  mainWindow = new BrowserWindow({
    ...bounds,
    width: bounds.width || 380,
    height: bounds.height || 220,
    minWidth: 300,
    minHeight: 180,
    maxWidth: 900,
    maxHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: "#241d1a",
    thickFrame: true,
    hasShadow: true,
    icon: path.join(__dirname, "assets", "icon.png"),
    resizable: true,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setAlwaysOnTop(settings.alwaysOnTop, "floating");
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("moved", scheduleBoundsSave);
  mainWindow.on("resized", scheduleBoundsSave);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.on("closed", () => {
    if (hudWindow && !hudWindow.isDestroyed()) hudWindow.close();
    mainWindow = undefined;
  });
}

function closeHud() {
  if (hudWindow && !hudWindow.isDestroyed()) hudWindow.close();
  hudWindow = undefined;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function openHud() {
  if (!mainWindow || mainWindow.isDestroyed() || hudWindow) return;
  const settings = readSettings();
  const source = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(source);
  const saved = settings.hudBounds;
  const width = Math.max(120, Math.min(420, Number(saved?.width) || 230));
  const height = Math.max(45, Math.min(160, Number(saved?.height) || 86));
  const bounds = {
    x: Math.max(workArea.x, Math.min(saved?.x ?? source.x, workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(saved?.y ?? source.y, workArea.y + workArea.height - height)),
    width,
    height
  };

  hudWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    focusable: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "hud-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  hudWindow.setAlwaysOnTop(true, "screen-saver");
  hudWindow.loadFile(path.join(__dirname, "src", "hud.html"), {
    query: {
      color: settings.clockColor,
      hudColor: settings.hudColor || settings.clockColor,
      opacity: String(settings.hudOpacity),
      font: settings.clockFont,
      hour24: String(settings.hour24)
    }
  });
  hudWindow.once("ready-to-show", () => {
    mainWindow.hide();
    hudWindow.showInactive();
  });
  hudWindow.on("move", scheduleHudBoundsSave);
  hudWindow.on("resize", scheduleHudBoundsSave);
  hudWindow.on("closed", () => {
    hudWindow = undefined;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });
}

function scheduleHudBoundsSave() {
  clearTimeout(hudSaveTimer);
  hudSaveTimer = setTimeout(() => {
    if (!hudWindow || hudWindow.isDestroyed()) return;
    writeSettings({ ...readSettings(), hudBounds: hudWindow.getBounds() });
  }, 200);
}

function resizeHudFromWheel(direction) {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  const current = hudWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(current);
  const width = Math.max(120, Math.min(420, current.width + (direction > 0 ? 18 : -18)));
  const height = Math.max(45, Math.min(160, Math.round(width / 2.67)));
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;
  hudWindow.setBounds({
    x: Math.max(workArea.x, Math.min(Math.round(centerX - width / 2), workArea.x + workArea.width - width)),
    y: Math.max(workArea.y, Math.min(Math.round(centerY - height / 2), workArea.y + workArea.height - height)),
    width,
    height
  }, true);
}

function toggleHud() {
  if (hudWindow) closeHud();
  else openHud();
}

function scheduleBoundsSave() {
  if (isCustomizing) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const settings = readSettings();
    const bounds = mainWindow.getBounds();
    const namedSize = Object.entries(windowSizes).find(([, size]) => size.width === bounds.width && size.height === bounds.height)?.[0];
    writeSettings({ ...settings, bounds, windowSize: namedSize || "custom" });
  }, 200);
}

ipcMain.handle("settings:get", () => readSettings());
ipcMain.handle("battery:available", () => hasSystemBattery());
ipcMain.on("notification:show", (_event, title, body) => {
  if (Notification.isSupported()) new Notification({ title: String(title), body: String(body) }).show();
});
ipcMain.handle("settings:update", (_event, patch) => {
  const allowed = [
    "alwaysOnTop", "hour24", "showSeconds", "showDate", "theme", "clockFont", "clockPanels",
    "clockColor", "wallpaperDim", "windowSize", "weatherLocation", "weatherUnit", "elementPositions",
    "pomodoroWork", "pomodoroBreak", "pomodoroLongBreak", "pomodoroSessions", "pomodoroState",
    "hudColor", "hudOpacity"
  ];
  const safePatch = Object.fromEntries(
    Object.entries(patch || {}).filter(([key]) => allowed.includes(key))
  );
  const next = { ...readSettings(), ...safePatch };
  writeSettings(next);
  if (typeof safePatch.alwaysOnTop === "boolean" && mainWindow) {
    mainWindow.setAlwaysOnTop(safePatch.alwaysOnTop, "floating");
  }
  return next;
});
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.on("hud:toggle", toggleHud);
ipcMain.on("hud:close", closeHud);
ipcMain.on("hud:resize-wheel", (_event, direction) => resizeHudFromWheel(Number(direction)));
ipcMain.on("hud:move-by", (_event, deltaX, deltaY) => {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  const bounds = hudWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(bounds);
  const x = Math.max(workArea.x, Math.min(bounds.x + Math.round(Number(deltaX) || 0), workArea.x + workArea.width - bounds.width));
  const y = Math.max(workArea.y, Math.min(bounds.y + Math.round(Number(deltaY) || 0), workArea.y + workArea.height - bounds.height));
  hudWindow.setPosition(x, y);
});
ipcMain.handle("window:resize-step", (_event, direction) => {
  if (!mainWindow || mainWindow.isDestroyed() || isCustomizing) return readSettings();
  const current = mainWindow.getBounds();
  const amount = direction < 0 ? -1 : 1;
  const nextBounds = clampBoundsToWorkArea({
    ...current,
    width: current.width + amount * 70,
    height: current.height + amount * 40
  });
  const nextSettings = { ...readSettings(), bounds: nextBounds, windowSize: "custom" };
  writeSettings(nextSettings);
  mainWindow.setBounds(nextBounds, true);
  return nextSettings;
});
ipcMain.handle("window:size-preset", (_event, sizeName) => {
  const size = windowSizes[sizeName];
  if (!size || !mainWindow || mainWindow.isDestroyed()) return readSettings();
  const base = isCustomizing && compactBounds ? compactBounds : mainWindow.getBounds();
  const nextBounds = clampBoundsToWorkArea({ ...base, ...size });
  const nextSettings = { ...readSettings(), windowSize: sizeName, bounds: nextBounds };
  writeSettings(nextSettings);
  if (isCustomizing) compactBounds = nextBounds;
  else mainWindow.setBounds(nextBounds, true);
  return nextSettings;
});
ipcMain.handle("window:customize", (_event, enabled) => {
  if (!mainWindow || mainWindow.isDestroyed() || Boolean(enabled) === isCustomizing) return;
  if (enabled) {
    clearTimeout(saveTimer);
    compactBounds = mainWindow.getBounds();
    isCustomizing = true;
    const { workArea } = screen.getDisplayMatching(compactBounds);
    const width = Math.min(760, workArea.width);
    const height = Math.min(390, workArea.height);
    mainWindow.setBounds({
      x: Math.max(workArea.x, Math.min(compactBounds.x, workArea.x + workArea.width - width)),
      y: Math.max(workArea.y, Math.min(compactBounds.y, workArea.y + workArea.height - height)),
      width,
      height
    }, true);
  } else {
    isCustomizing = false;
    if (compactBounds) mainWindow.setBounds(clampBoundsToWorkArea(compactBounds), true);
    compactBounds = undefined;
    scheduleBoundsSave();
  }
});
ipcMain.handle("wallpaper:get", () => currentWallpaper());
ipcMain.handle("wallpaper:import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a Cozy Clock wallpaper",
    properties: ["openFile"],
    filters: [{ name: "Images and animated GIFs", extensions: ["jpg", "jpeg", "png", "webp", "gif"] }]
  });
  if (result.canceled) return currentWallpaper();

  fs.mkdirSync(wallpaperDirectory(), { recursive: true });
  clearCurrentWallpaper();
  const extension = path.extname(result.filePaths[0]).toLowerCase();
  fs.copyFileSync(result.filePaths[0], path.join(wallpaperDirectory(), `custom${extension}`));
  return currentWallpaper();
});
ipcMain.handle("wallpaper:remove", () => {
  clearCurrentWallpaper();
  return null;
});
ipcMain.handle("presets:list", () => publicPresets());
ipcMain.handle("presets:save", (_event, rawName) => {
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 40) : "";
  if (!name) throw new Error("Give this style a name first.");

  fs.mkdirSync(presetsDirectory(), { recursive: true });
  const id = crypto.randomUUID();
  const sourceWallpaper = currentWallpaperPath();
  let presetWallpaper = null;
  if (sourceWallpaper) {
    presetWallpaper = path.join(presetsDirectory(), `${id}${path.extname(sourceWallpaper).toLowerCase()}`);
    fs.copyFileSync(sourceWallpaper, presetWallpaper);
  }
  const current = readSettings();
  const layoutBounds = isCustomizing && compactBounds ? compactBounds : mainWindow.getBounds();
  const preset = {
    id,
    name,
    createdAt: new Date().toISOString(),
    theme: current.theme,
    clockFont: current.clockFont,
    clockPanels: current.clockPanels,
    clockColor: current.clockColor,
    wallpaperDim: current.wallpaperDim,
    hour24: current.hour24,
    showSeconds: current.showSeconds,
    showDate: current.showDate,
    weatherLocation: current.weatherLocation,
    weatherUnit: current.weatherUnit,
    elementPositions: current.elementPositions,
    pomodoroWork: current.pomodoroWork,
    pomodoroBreak: current.pomodoroBreak,
    pomodoroLongBreak: current.pomodoroLongBreak,
    pomodoroSessions: current.pomodoroSessions,
    hudColor: current.hudColor,
    hudOpacity: current.hudOpacity,
    windowSize: current.windowSize,
    width: layoutBounds.width,
    height: layoutBounds.height,
    wallpaperPath: presetWallpaper
  };
  const presets = [...readPresets(), preset];
  fs.writeFileSync(presetsPath(), JSON.stringify(presets, null, 2));
  return publicPresets();
});
ipcMain.handle("presets:apply", (_event, presetId) => {
  const preset = readPresets().find(({ id }) => id === presetId);
  if (!preset) throw new Error("That saved style no longer exists.");

  const next = {
    ...readSettings(),
    theme: preset.theme,
    clockFont: preset.clockFont,
    clockPanels: preset.clockPanels,
    clockColor: preset.clockColor,
    wallpaperDim: preset.wallpaperDim,
    hour24: typeof preset.hour24 === "boolean" ? preset.hour24 : readSettings().hour24,
    showSeconds: typeof preset.showSeconds === "boolean" ? preset.showSeconds : readSettings().showSeconds,
    showDate: typeof preset.showDate === "boolean" ? preset.showDate : readSettings().showDate,
    weatherLocation: preset.weatherLocation ?? readSettings().weatherLocation,
    weatherUnit: preset.weatherUnit || readSettings().weatherUnit,
    elementPositions: preset.elementPositions || {},
    pomodoroWork: preset.pomodoroWork || readSettings().pomodoroWork,
    pomodoroBreak: preset.pomodoroBreak || readSettings().pomodoroBreak,
    pomodoroLongBreak: preset.pomodoroLongBreak || readSettings().pomodoroLongBreak,
    pomodoroSessions: preset.pomodoroSessions || readSettings().pomodoroSessions,
    hudColor: preset.hudColor ?? readSettings().hudColor,
    hudOpacity: Number.isFinite(preset.hudOpacity) ? preset.hudOpacity : readSettings().hudOpacity,
    windowSize: preset.windowSize || readSettings().windowSize
  };
  if (Number.isFinite(preset.width) && Number.isFinite(preset.height)) {
    const base = isCustomizing && compactBounds ? compactBounds : mainWindow.getBounds();
    const layoutBounds = clampBoundsToWorkArea({ ...base, width: preset.width, height: preset.height });
    next.bounds = layoutBounds;
    if (isCustomizing) compactBounds = layoutBounds;
    else mainWindow.setBounds(layoutBounds, true);
  }
  writeSettings(next);
  clearCurrentWallpaper();
  if (preset.wallpaperPath && fs.existsSync(preset.wallpaperPath)) {
    fs.mkdirSync(wallpaperDirectory(), { recursive: true });
    fs.copyFileSync(preset.wallpaperPath, path.join(wallpaperDirectory(), `custom${path.extname(preset.wallpaperPath)}`));
  }
  return { settings: next, wallpaper: currentWallpaper() };
});
ipcMain.handle("presets:remove", (_event, presetId) => {
  const presets = readPresets();
  const preset = presets.find(({ id }) => id === presetId);
  if (preset?.wallpaperPath) {
    try { fs.unlinkSync(preset.wallpaperPath); } catch {}
  }
  fs.writeFileSync(presetsPath(), JSON.stringify(presets.filter(({ id }) => id !== presetId), null, 2));
  return publicPresets();
});
ipcMain.handle("music:list", () => publicTracks());
ipcMain.handle("music:import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Add music to Cozy Clock",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio and video", extensions: ["mp3", "m4a", "wav", "ogg", "flac", "mp4", "webm"] }
    ]
  });
  if (result.canceled) return publicTracks();

  fs.mkdirSync(mediaDirectory(), { recursive: true });
  const library = readLibrary();
  for (const sourcePath of result.filePaths) {
    const extension = path.extname(sourcePath).toLowerCase();
    const id = crypto.randomUUID();
    const destination = path.join(mediaDirectory(), `${id}${extension}`);
    fs.copyFileSync(sourcePath, destination);
    library.push({
      id,
      title: path.basename(sourcePath, extension),
      filePath: destination
    });
  }
  fs.writeFileSync(libraryPath(), JSON.stringify(library, null, 2));
  return publicTracks();
});
ipcMain.handle("music:remove", (_event, trackId) => {
  if (typeof trackId !== "string") return publicTracks();
  const library = readLibrary();
  const track = library.find(({ id }) => id === trackId);
  if (track) {
    try { fs.unlinkSync(track.filePath); } catch {}
  }
  const next = library.filter(({ id }) => id !== trackId);
  fs.writeFileSync(libraryPath(), JSON.stringify(next, null, 2));
  return publicTracks();
});
ipcMain.handle("music:youtube", async (_event, videoUrl) => {
  if (typeof videoUrl !== "string" || !isYouTubeUrl(videoUrl.trim())) {
    throw new Error("Enter a valid YouTube video link.");
  }

  fs.mkdirSync(mediaDirectory(), { recursive: true });
  const id = crypto.randomUUID();
  const destination = path.join(mediaDirectory(), `${id}.mp4`);

  try {
    const metadata = await youtubeDl(videoUrl.trim(), {
      dumpSingleJson: true,
      skipDownload: true,
      noPlaylist: true,
      noWarnings: true
    });
    await youtubeDl(videoUrl.trim(), {
      output: destination,
      format: "bestaudio[ext=mp4]/bestaudio[ext=m4a]",
      noPlaylist: true,
      noWarnings: true,
      maxFilesize: "500M"
    });
    if (!fs.existsSync(destination)) throw new Error("No compatible MP4 was available for this video.");

    const library = readLibrary();
    library.push({
      id,
      title: typeof metadata?.title === "string" ? metadata.title : "YouTube track",
      filePath: destination
    });
    fs.writeFileSync(libraryPath(), JSON.stringify(library, null, 2));
    return publicTracks();
  } catch (error) {
    try { if (fs.existsSync(destination)) fs.unlinkSync(destination); } catch {}
    throw new Error(error?.message || "The YouTube video could not be downloaded.");
  }
});

app.whenReady().then(() => {
  createWindow();
  globalShortcut.register("CommandOrControl+Shift+H", toggleHud);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());
app.on("will-quit", () => globalShortcut.unregisterAll());
