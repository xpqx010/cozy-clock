const elements = {
  body: document.body,
  day: document.querySelector("#day"),
  date: document.querySelector("#date"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
  period: document.querySelector("#period"),
  greeting: document.querySelector("#greeting"),
  pin: document.querySelector("#pin"),
  panel: document.querySelector("#settings-panel"),
  settingsButton: document.querySelector("#settings-button"),
  battery: document.querySelector("#battery"),
  batteryLevel: document.querySelector("#battery-level"),
  musicButton: document.querySelector("#music-button"),
  musicPlayer: document.querySelector("#music-player"),
  libraryPanel: document.querySelector("#library-panel"),
  trackList: document.querySelector("#track-list"),
  audio: document.querySelector("#audio"),
  trackTitle: document.querySelector("#track-title"),
  trackProgress: document.querySelector("#track-progress"),
  elapsed: document.querySelector("#elapsed"),
  playTrack: document.querySelector("#play-track")
};

let settings = {
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
let previousMinute;
let tracks = [];
let trackIndex = 0;
let wallpaper = null;

function updateClock() {
  const now = new Date();
  const hour = now.getHours();
  const displayHour = settings.hour24 ? hour : (hour % 12 || 12);

  if (previousMinute !== undefined && previousMinute !== now.getMinutes() && settings.theme === "elden") {
    const card = document.querySelector("#minute-card");
    card.classList.remove("minute-turn");
    requestAnimationFrame(() => card.classList.add("minute-turn"));
  }
  previousMinute = now.getMinutes();

  elements.hours.textContent = String(displayHour).padStart(2, "0");
  elements.minutes.textContent = String(now.getMinutes()).padStart(2, "0");
  elements.seconds.textContent = String(now.getSeconds()).padStart(2, "0");
  elements.period.textContent = settings.hour24 ? "24H" : (hour >= 12 ? "PM" : "AM");
  elements.day.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now);
  elements.date.textContent = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(now);
  document.querySelector("#preview-hours").textContent = String(displayHour).padStart(2, "0");
  document.querySelector("#preview-minutes").textContent = String(now.getMinutes()).padStart(2, "0");
  document.querySelector("#preview-day").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now);

  if (settings.theme === "elden") elements.greeting.textContent = "Grace guides thee";
  else if (hour < 5) elements.greeting.textContent = "Quiet hours";
  else if (hour < 12) elements.greeting.textContent = "Slow morning";
  else if (hour < 17) elements.greeting.textContent = "Gentle afternoon";
  else if (hour < 21) elements.greeting.textContent = "Cozy evening";
  else elements.greeting.textContent = "Wind down";
}

function renderSettings() {
  elements.body.dataset.theme = settings.theme;
  elements.body.dataset.font = settings.clockFont;
  elements.body.dataset.panels = settings.clockPanels;
  elements.body.style.setProperty("--custom-accent", settings.clockColor);
  elements.pin.classList.toggle("is-active", settings.alwaysOnTop);
  elements.pin.setAttribute("aria-pressed", String(settings.alwaysOnTop));
  elements.date.hidden = !settings.showDate;
  elements.seconds.hidden = !settings.showSeconds;

  for (const key of ["hour24", "showSeconds", "showDate"]) {
    document.querySelector(`#${key}`).setAttribute("aria-checked", String(settings[key]));
  }
  document.querySelectorAll(".theme-swatch").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.theme === settings.theme);
  });
  const themeNames = { ember: "Ember", sage: "Sage", dusk: "Dusk", elden: "Elden Ring" };
  document.querySelector("#theme-name").textContent = themeNames[settings.theme] || "Custom";
  document.querySelector("#clock-font").value = settings.clockFont;
  document.querySelectorAll("[data-panels]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.panels === settings.clockPanels));
  });
  document.querySelector("#clock-color").value = settings.clockColor;
  document.querySelector("#color-value").textContent = settings.clockColor.toUpperCase();
  document.querySelector("#wallpaper-dim").value = settings.wallpaperDim;
  document.querySelector("#dim-value").textContent = `${settings.wallpaperDim}%`;
  document.querySelector("#wallpaper-shade").style.opacity = String(settings.wallpaperDim / 100);
  document.querySelector("#preview-shade").style.opacity = String(settings.wallpaperDim / 100);
  updateClock();
}

function renderWallpaper(cacheBust = false) {
  const image = document.querySelector("#custom-wallpaper");
  const previewImage = document.querySelector("#preview-wallpaper");
  const status = document.querySelector("#wallpaper-status");
  const remove = document.querySelector("#wallpaper-remove");
  elements.body.classList.toggle("has-wallpaper", Boolean(wallpaper));
  image.hidden = !wallpaper;
  previewImage.hidden = !wallpaper;
  remove.disabled = !wallpaper;
  if (wallpaper) {
    const source = cacheBust ? `${wallpaper.url}?v=${Date.now()}` : wallpaper.url;
    image.src = source;
    previewImage.src = source;
    status.textContent = wallpaper.animated ? "Animated GIF active" : "Custom photo active";
  } else {
    image.removeAttribute("src");
    previewImage.removeAttribute("src");
    status.textContent = "JPG, PNG, WEBP or animated GIF";
  }
}

async function save(patch) {
  settings = await window.cozyClock.updateSettings(patch);
  renderSettings();
}

function setPanel(open) {
  elements.panel.hidden = !open;
  elements.settingsButton.setAttribute("aria-expanded", String(open));
  elements.body.classList.toggle("is-customizing", open);
  window.cozyClock.setCustomizationMode(open);
  if (open) document.querySelector("#settings-close").focus();
  else elements.settingsButton.focus();
}

function closePersonalization() {
  document.querySelector("#personalize-panel").hidden = true;
  elements.panel.hidden = false;
  document.querySelector("#personalize-button").focus();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function loadTrack(index, autoplay = false) {
  if (!tracks.length) {
    elements.audio.removeAttribute("src");
    elements.trackTitle.textContent = "Choose your music";
    elements.trackProgress.value = 0;
    elements.elapsed.textContent = "0:00";
    elements.playTrack.disabled = true;
    renderLibrary();
    return;
  }
  trackIndex = (index + tracks.length) % tracks.length;
  elements.audio.src = tracks[trackIndex].url;
  elements.trackTitle.textContent = tracks[trackIndex].title;
  elements.playTrack.disabled = false;
  renderLibrary();
  if (autoplay) elements.audio.play().catch(() => {});
}

function renderLibrary() {
  document.querySelector("#track-count").textContent = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`;
  document.querySelector("#library-empty").hidden = tracks.length > 0;
  elements.trackList.replaceChildren(...tracks.map((track, index) => {
    const item = document.createElement("li");
    item.className = `track-item${index === trackIndex ? " is-current" : ""}`;
    item.dataset.index = String(index);

    const select = document.createElement("button");
    select.type = "button";
    select.className = "track-select";
    const number = document.createElement("span");
    number.className = "track-number";
    number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("span");
    title.className = "track-list-title";
    title.textContent = track.title;
    select.append(number, title);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "player-button track-remove";
    remove.dataset.removeId = track.id;
    remove.setAttribute("aria-label", `Remove ${track.title}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 7l1 13h6l1-13"/></svg>';
    item.append(select, remove);
    return item;
  }));
}

function setMusicPlayer(open) {
  elements.musicPlayer.hidden = !open;
  elements.musicButton.classList.toggle("is-active", open);
  elements.musicButton.setAttribute("aria-expanded", String(open));
}

elements.pin.addEventListener("click", () => save({ alwaysOnTop: !settings.alwaysOnTop }));
elements.settingsButton.addEventListener("click", () => setPanel(true));
elements.musicButton.addEventListener("click", () => {
  const opening = elements.musicPlayer.hidden;
  setMusicPlayer(opening);
  if (opening && !tracks.length) elements.libraryPanel.hidden = false;
});
document.querySelector("#settings-close").addEventListener("click", () => setPanel(false));
document.querySelector("#personalize-button").addEventListener("click", () => {
  elements.panel.hidden = true;
  document.querySelector("#personalize-panel").hidden = false;
  document.querySelector("#personalize-close").focus();
});
document.querySelector("#personalize-close").addEventListener("click", () => {
  closePersonalization();
});
document.querySelector("#wallpaper-upload").addEventListener("click", async () => {
  wallpaper = await window.cozyClock.importWallpaper();
  renderWallpaper(true);
});
document.querySelector("#wallpaper-remove").addEventListener("click", async () => {
  wallpaper = await window.cozyClock.removeWallpaper();
  renderWallpaper();
});
document.querySelector("#clock-font").addEventListener("input", (event) => {
  elements.body.dataset.font = event.target.value;
});
document.querySelector("#clock-font").addEventListener("change", (event) => save({ clockFont: event.target.value }));
document.querySelectorAll("[data-panels]").forEach((button) => {
  button.addEventListener("click", () => save({ clockPanels: button.dataset.panels }));
});
document.querySelector("#clock-color").addEventListener("input", (event) => {
  elements.body.style.setProperty("--custom-accent", event.target.value);
  document.querySelector("#color-value").textContent = event.target.value.toUpperCase();
});
document.querySelector("#clock-color").addEventListener("change", (event) => save({ clockColor: event.target.value }));
document.querySelector("#wallpaper-dim").addEventListener("input", (event) => {
  document.querySelector("#wallpaper-shade").style.opacity = String(Number(event.target.value) / 100);
  document.querySelector("#preview-shade").style.opacity = String(Number(event.target.value) / 100);
  document.querySelector("#dim-value").textContent = `${event.target.value}%`;
});
document.querySelector("#wallpaper-dim").addEventListener("change", (event) => save({ wallpaperDim: Number(event.target.value) }));
document.querySelector("#music-close").addEventListener("click", () => setMusicPlayer(false));
document.querySelector("#library-button").addEventListener("click", () => {
  elements.libraryPanel.hidden = false;
  renderLibrary();
  document.querySelector("#library-close").focus();
});
document.querySelector("#library-close").addEventListener("click", () => {
  elements.libraryPanel.hidden = true;
});
document.querySelector("#youtube-music").addEventListener("click", () => {
  document.querySelector("#youtube-panel").hidden = false;
  document.querySelector("#youtube-url").focus();
});
document.querySelector("#youtube-close").addEventListener("click", () => {
  document.querySelector("#youtube-panel").hidden = true;
});
document.querySelector("#minimize").addEventListener("click", window.cozyClock.minimize);
document.querySelector("#close").addEventListener("click", window.cozyClock.close);

for (const key of ["hour24", "showSeconds", "showDate"]) {
  document.querySelector(`#${key}`).addEventListener("click", () => save({ [key]: !settings[key] }));
}

document.querySelectorAll(".theme-swatch").forEach((button) => {
  button.addEventListener("click", () => save({ theme: button.dataset.theme }));
});

elements.playTrack.addEventListener("click", () => {
  if (!tracks.length) return;
  if (elements.audio.paused) elements.audio.play().catch(() => {});
  else elements.audio.pause();
});
document.querySelector("#previous-track").addEventListener("click", () => loadTrack(trackIndex - 1, true));
document.querySelector("#next-track").addEventListener("click", () => loadTrack(trackIndex + 1, true));
document.querySelector("#add-music").addEventListener("click", async () => {
  const previousCount = tracks.length;
  tracks = await window.cozyClock.importMusic();
  loadTrack(previousCount < tracks.length ? previousCount : trackIndex, previousCount < tracks.length);
});
elements.trackList.addEventListener("click", async (event) => {
  const remove = event.target.closest("[data-remove-id]");
  if (remove) {
    const currentId = tracks[trackIndex]?.id;
    const removingCurrent = currentId === remove.dataset.removeId;
    if (removingCurrent) elements.audio.pause();
    tracks = await window.cozyClock.removeMusic(remove.dataset.removeId);
    if (removingCurrent || !tracks.length) loadTrack(Math.min(trackIndex, tracks.length - 1), false);
    else {
      trackIndex = Math.max(0, tracks.findIndex((track) => track.id === currentId));
      renderLibrary();
    }
    return;
  }
  const item = event.target.closest(".track-item");
  if (item) {
    loadTrack(Number(item.dataset.index), true);
    elements.libraryPanel.hidden = true;
  }
});
document.querySelector("#youtube-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#youtube-url");
  const button = document.querySelector("#youtube-download");
  const status = document.querySelector("#download-status");
  const previousCount = tracks.length;

  button.disabled = true;
  button.textContent = "Saving...";
  status.classList.remove("is-error");
  status.textContent = "Downloading and adding the MP4 to your library...";
  try {
    tracks = await window.cozyClock.importYouTube(input.value);
    loadTrack(previousCount < tracks.length ? previousCount : tracks.length - 1, true);
    input.value = "";
    status.textContent = "Saved. Your new track is playing now.";
    document.querySelector("#youtube-panel").hidden = true;
    elements.libraryPanel.hidden = false;
  } catch (error) {
    status.classList.add("is-error");
    status.textContent = String(error.message || error).replace(/^Error invoking remote method '[^']+': Error: /, "");
  } finally {
    button.disabled = false;
    button.textContent = "Download";
  }
});

elements.audio.addEventListener("play", () => {
  elements.musicPlayer.classList.add("is-playing");
  elements.playTrack.setAttribute("aria-label", "Pause");
});
elements.audio.addEventListener("pause", () => {
  elements.musicPlayer.classList.remove("is-playing");
  elements.playTrack.setAttribute("aria-label", "Play");
});
elements.audio.addEventListener("ended", () => loadTrack(trackIndex + 1, true));
elements.audio.addEventListener("timeupdate", () => {
  const percent = elements.audio.duration ? (elements.audio.currentTime / elements.audio.duration) * 100 : 0;
  elements.trackProgress.value = percent;
  elements.elapsed.textContent = formatTime(elements.audio.currentTime);
});
elements.trackProgress.addEventListener("input", () => {
  if (elements.audio.duration) elements.audio.currentTime = (Number(elements.trackProgress.value) / 100) * elements.audio.duration;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.panel.hidden) setPanel(false);
  else if (event.key === "Escape" && !document.querySelector("#personalize-panel").hidden) closePersonalization();
  else if (event.key === "Escape" && !document.querySelector("#youtube-panel").hidden) document.querySelector("#youtube-panel").hidden = true;
  else if (event.key === "Escape" && !elements.libraryPanel.hidden) elements.libraryPanel.hidden = true;
});

async function monitorBattery() {
  if (!("getBattery" in navigator)) return;
  const battery = await navigator.getBattery();
  const update = () => {
    elements.battery.hidden = false;
    elements.batteryLevel.textContent = `${Math.round(battery.level * 100)}%`;
  };
  battery.addEventListener("levelchange", update);
  battery.addEventListener("chargingchange", update);
  update();
}

window.cozyClock.getSettings().then((saved) => {
  settings = { ...settings, ...saved };
  renderSettings();
});

window.cozyClock.getWallpaper().then((savedWallpaper) => {
  wallpaper = savedWallpaper;
  renderWallpaper();
});

window.cozyClock.listMusic().then((savedTracks) => {
  tracks = savedTracks;
  loadTrack(0);
});

updateClock();
setInterval(updateClock, 1000);
monitorBattery().catch(() => {});
