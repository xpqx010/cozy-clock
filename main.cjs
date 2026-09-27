const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
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

const defaults = {
  alwaysOnTop: true,
  hour24: false,
  showSeconds: false,
  showDate: true,
  theme: "ember",
  clockFont: "rounded",
  clockPanels: "full",
  clockColor: "#ed795f",
  wallpaperDim: 45
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

function currentWallpaper() {
  try {
    const fileName = fs.readdirSync(wallpaperDirectory()).find((name) => name.startsWith("custom."));
    if (!fileName) return null;
    const filePath = path.join(wallpaperDirectory(), fileName);
    return { url: pathToFileURL(filePath).href, animated: path.extname(fileName).toLowerCase() === ".gif" };
  } catch {
    return null;
  }
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

function createWindow() {
  const settings = readSettings();
  const savedBounds = settings.bounds;
  const bounds = boundsAreVisible(savedBounds)
    ? savedBounds
    : { width: 430, height: 250 };

  mainWindow = new BrowserWindow({
    ...bounds,
    width: bounds.width || 430,
    height: bounds.height || 250,
    minWidth: 380,
    minHeight: 220,
    maxWidth: 900,
    maxHeight: 500,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
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
}

function scheduleBoundsSave() {
  if (isCustomizing) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const settings = readSettings();
    writeSettings({ ...settings, bounds: mainWindow.getBounds() });
  }, 200);
}

ipcMain.handle("settings:get", () => readSettings());
ipcMain.handle("settings:update", (_event, patch) => {
  const allowed = ["alwaysOnTop", "hour24", "showSeconds", "showDate", "theme", "clockFont", "clockPanels", "clockColor", "wallpaperDim"];
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
    if (compactBounds) mainWindow.setBounds(compactBounds, true);
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
  for (const fileName of fs.readdirSync(wallpaperDirectory())) {
    if (fileName.startsWith("custom.")) fs.unlinkSync(path.join(wallpaperDirectory(), fileName));
  }
  const extension = path.extname(result.filePaths[0]).toLowerCase();
  fs.copyFileSync(result.filePaths[0], path.join(wallpaperDirectory(), `custom${extension}`));
  return currentWallpaper();
});
ipcMain.handle("wallpaper:remove", () => {
  try {
    for (const fileName of fs.readdirSync(wallpaperDirectory())) {
      if (fileName.startsWith("custom.")) fs.unlinkSync(path.join(wallpaperDirectory(), fileName));
    }
  } catch {}
  return null;
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
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());
