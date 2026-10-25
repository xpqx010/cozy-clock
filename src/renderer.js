const elements = {
  body: document.body,
  day: document.querySelector("#day"),
  date: document.querySelector("#date"),
  hours: document.querySelector("#hours"),
  minutes: document.querySelector("#minutes"),
  seconds: document.querySelector("#seconds"),
  period: document.querySelector("#period"),
  weather: document.querySelector("#weather"),
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
  playTrack: document.querySelector("#play-track"),
  pomodoroPanel: document.querySelector("#pomodoro-panel"),
  pomodoroTime: document.querySelector("#pomodoro-time")
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
  hudOpacity: 100
};
let previousMinute;
let tracks = [];
let trackIndex = 0;
let wallpaper = null;
let presets = [];
let pomodoroOpen = false;
let weatherRefreshTimer;
let layoutEditing = false;

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
  document.querySelectorAll("[data-window-size]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.windowSize === settings.windowSize));
  });
  document.querySelector("#clock-color").value = settings.clockColor;
  document.querySelector("#color-value").textContent = settings.clockColor.toUpperCase();
  document.querySelector("#wallpaper-dim").value = settings.wallpaperDim;
  document.querySelector("#dim-value").textContent = `${settings.wallpaperDim}%`;
  document.querySelector("#wallpaper-shade").style.opacity = String(settings.wallpaperDim / 100);
  document.querySelector("#preview-shade").style.opacity = String(settings.wallpaperDim / 100);
  document.querySelector("#weather-city").value = settings.weatherLocation?.name || "";
  document.querySelectorAll("[data-weather-unit]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.weatherUnit === settings.weatherUnit));
  });
  document.querySelector("#pomodoro-work").value = settings.pomodoroWork;
  document.querySelector("#pomodoro-break").value = settings.pomodoroBreak;
  const hudColor = settings.hudColor || settings.clockColor;
  document.querySelector("#hud-color").value = hudColor;
  document.querySelector("#hud-color-value").textContent = hudColor.toUpperCase();
  document.querySelector("#hud-opacity").value = settings.hudOpacity;
  document.querySelector("#hud-opacity-value").textContent = `${settings.hudOpacity}%`;
  applyElementPositions();
  renderPomodoro();
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
    image.addEventListener("load", suggestWallpaperColors, { once: true });
    status.textContent = wallpaper.animated ? "Animated GIF active" : "Custom photo active";
  } else {
    image.removeAttribute("src");
    previewImage.removeAttribute("src");
    status.textContent = "JPG, PNG, WEBP or animated GIF";
    document.querySelector("#color-suggestions").hidden = true;
  }
}

function renderPresets() {
  const list = document.querySelector("#preset-list");
  document.querySelector("#preset-count").textContent = `${presets.length} saved`;
  document.querySelector("#preset-empty").hidden = presets.length > 0;
  list.replaceChildren(...presets.map((preset) => {
    const item = document.createElement("li");
    item.className = "preset-item";

    const select = document.createElement("button");
    select.type = "button";
    select.className = "preset-select";
    select.dataset.presetId = preset.id;
    if (preset.wallpaperUrl) select.style.backgroundImage = `url("${preset.wallpaperUrl}")`;
    const title = document.createElement("span");
    title.textContent = preset.name;
    select.append(title);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "player-button preset-remove";
    remove.dataset.removePreset = preset.id;
    remove.setAttribute("aria-label", `Delete ${preset.name}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M8 7l1 13h6l1-13"/></svg>';
    item.append(select, remove);
    return item;
  }));
}

function applyElementPositions() {
  const positions = settings.elementPositions || {};
  for (const key of ["time", "date", "seconds", "weather", "battery"]) {
    const position = positions[key] || { x: 0, y: 0 };
    elements.body.style.setProperty(`--${key}-x`, `${Number(position.x) || 0}px`);
    elements.body.style.setProperty(`--${key}-y`, `${Number(position.y) || 0}px`);
  }
}

function suggestWallpaperColors() {
  const image = document.querySelector("#custom-wallpaper");
  if (!wallpaper || !image.naturalWidth) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 48, 48);
    const pixels = context.getImageData(0, 0, 48, 48).data;
    const bins = new Map();
    let luminance = 0;
    let samples = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index + 3] < 150) continue;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max ? (max - min) / max : 0;
      const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
      const current = bins.get(key) || { r, g, b, score: 0 };
      current.score += .35 + saturation;
      bins.set(key, current);
      luminance += .2126 * r + .7152 * g + .0722 * b;
      samples += 1;
    }
    const colors = [...bins.values()].sort((a, b) => b.score - a.score).slice(0, 3);
    colors.unshift((luminance / Math.max(1, samples)) < 130
      ? { r: 246, g: 235, b: 217 }
      : { r: 35, g: 29, b: 26 });
    const container = document.querySelector("#suggested-colors");
    container.replaceChildren(...colors.map(({ r, g, b }) => {
      const hex = `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggested-color";
      button.style.background = hex;
      button.dataset.color = hex;
      button.setAttribute("aria-label", `Use suggested color ${hex}`);
      return button;
    }));
    document.querySelector("#color-suggestions").hidden = false;
  } catch {
    document.querySelector("#color-suggestions").hidden = true;
  }
}

function weatherLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 97, 99].includes(code)) return "Thunderstorm";
  return "Current weather";
}

async function refreshWeather() {
  clearTimeout(weatherRefreshTimer);
  const location = settings.weatherLocation;
  if (!location) {
    elements.weather.textContent = "Set weather in Settings";
    return;
  }
  try {
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,weather_code",
      temperature_unit: settings.weatherUnit
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`);
    if (!response.ok) throw new Error("Weather unavailable");
    const data = await response.json();
    const unit = settings.weatherUnit === "fahrenheit" ? "F" : "C";
    elements.weather.textContent = `${location.name}  ${Math.round(data.current.temperature_2m)} ${unit}  ${weatherLabel(data.current.weather_code)}`;
  } catch {
    elements.weather.textContent = `${location.name}  Weather unavailable`;
  }
  weatherRefreshTimer = setTimeout(refreshWeather, 15 * 60 * 1000);
}

function pomodoroDuration(mode) {
  if (mode === "focus") return settings.pomodoroWork * 60;
  if (mode === "longBreak") return settings.pomodoroLongBreak * 60;
  return settings.pomodoroBreak * 60;
}

function pomodoroRemaining() {
  const state = settings.pomodoroState;
  return state.running && state.endAt
    ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000))
    : Math.max(0, Number(state.remaining) || pomodoroDuration(state.mode));
}

function renderPomodoro() {
  const state = settings.pomodoroState;
  const remaining = pomodoroRemaining();
  elements.pomodoroTime.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  document.querySelector("#pomodoro-mode").textContent = state.mode === "focus" ? "Focus session" : (state.mode === "longBreak" ? "Long break" : "Short break");
  document.querySelector("#pomodoro-rounds").textContent = `${state.completed || 0} / ${settings.pomodoroSessions}`;
  document.querySelector("#pomodoro-start").textContent = state.running ? "Pause" : "Start";
}

async function persistPomodoro(state) {
  settings = await window.cozyClock.updateSettings({ pomodoroState: state });
  renderPomodoro();
}

async function finishPomodoro(skipped = false) {
  const state = settings.pomodoroState;
  let completed = state.completed || 0;
  let mode;
  if (state.mode === "focus") {
    completed += 1;
    mode = completed % settings.pomodoroSessions === 0 ? "longBreak" : "break";
    if (!skipped) window.cozyClock.notify("Focus session complete", mode === "longBreak" ? "Time for a long break." : "Time for a short break.");
  } else {
    mode = "focus";
    if (!skipped) window.cozyClock.notify("Break complete", "Ready for another focus session?");
  }
  await persistPomodoro({ mode, running: false, endAt: null, remaining: pomodoroDuration(mode), completed });
}

function tickPomodoro() {
  if (settings.pomodoroState.running && pomodoroRemaining() <= 0) finishPomodoro();
  else renderPomodoro();
}

async function save(patch) {
  settings = await window.cozyClock.updateSettings(patch);
  renderSettings();
}

function setPanel(open) {
  if (!open && layoutEditing) {
    layoutEditing = false;
    elements.body.classList.remove("layout-editing");
    document.querySelector("#layout-editor-toggle").setAttribute("aria-pressed", "false");
    document.querySelector("#layout-editor-toggle").textContent = "Arrange";
  }
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
document.querySelector("#hud-button").addEventListener("click", window.cozyClock.toggleHud);
document.querySelector("#pomodoro-button").addEventListener("click", () => {
  pomodoroOpen = !pomodoroOpen;
  elements.pomodoroPanel.hidden = !pomodoroOpen;
  elements.body.classList.toggle("pomodoro-active", pomodoroOpen);
  document.querySelector("#pomodoro-button").classList.toggle("is-active", pomodoroOpen);
  document.querySelector("#pomodoro-button").setAttribute("aria-pressed", String(pomodoroOpen));
  renderPomodoro();
});
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
document.querySelector("#hud-color").addEventListener("input", (event) => {
  document.querySelector("#hud-color-value").textContent = event.target.value.toUpperCase();
});
document.querySelector("#hud-color").addEventListener("change", (event) => save({ hudColor: event.target.value }));
document.querySelector("#hud-opacity").addEventListener("input", (event) => {
  document.querySelector("#hud-opacity-value").textContent = `${event.target.value}%`;
});
document.querySelector("#hud-opacity").addEventListener("change", (event) => save({ hudOpacity: Number(event.target.value) }));
document.querySelector("#suggested-colors").addEventListener("click", (event) => {
  const button = event.target.closest("[data-color]");
  if (button) save({ clockColor: button.dataset.color });
});
document.querySelector("#weather-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#weather-city");
  const status = document.querySelector("#weather-status");
  const name = input.value.trim();
  if (!name) return;
  status.textContent = "Finding city...";
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) throw new Error("City not found");
    settings = await window.cozyClock.updateSettings({
      weatherLocation: { name: result.name, country: result.country, latitude: result.latitude, longitude: result.longitude }
    });
    input.value = result.name;
    status.textContent = `${result.name}, ${result.country}`;
    refreshWeather();
  } catch (error) {
    status.textContent = error.message || "Could not find that city.";
  }
});
document.querySelectorAll("[data-weather-unit]").forEach((button) => {
  button.addEventListener("click", async () => {
    settings = await window.cozyClock.updateSettings({ weatherUnit: button.dataset.weatherUnit });
    renderSettings();
    refreshWeather();
  });
});

document.querySelector("#layout-editor-toggle").addEventListener("click", () => {
  layoutEditing = !layoutEditing;
  elements.body.classList.toggle("layout-editing", layoutEditing);
  document.querySelector("#layout-editor-toggle").setAttribute("aria-pressed", String(layoutEditing));
  document.querySelector("#layout-editor-toggle").textContent = layoutEditing ? "Done" : "Arrange";
});
document.querySelector("#layout-reset").addEventListener("click", async () => {
  settings = await window.cozyClock.updateSettings({ elementPositions: {} });
  applyElementPositions();
});
document.addEventListener("pointerdown", (event) => {
  if (!layoutEditing) return;
  const target = event.target.closest("[data-layout-key]");
  if (!target) return;
  event.preventDefault();
  const key = target.dataset.layoutKey;
  const start = settings.elementPositions?.[key] || { x: 0, y: 0 };
  const startX = event.clientX;
  const startY = event.clientY;
  target.setPointerCapture(event.pointerId);
  const move = (moveEvent) => {
    const position = { x: Math.round(start.x + moveEvent.clientX - startX), y: Math.round(start.y + moveEvent.clientY - startY) };
    settings.elementPositions = { ...(settings.elementPositions || {}), [key]: position };
    applyElementPositions();
  };
  const finish = async () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", finish);
    target.removeEventListener("pointercancel", finish);
    settings = await window.cozyClock.updateSettings({ elementPositions: settings.elementPositions });
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", finish);
  target.addEventListener("pointercancel", finish);
});

document.querySelector("#pomodoro-start").addEventListener("click", async () => {
  const state = settings.pomodoroState;
  const remaining = pomodoroRemaining();
  await persistPomodoro(state.running
    ? { ...state, running: false, endAt: null, remaining }
    : { ...state, running: true, endAt: Date.now() + remaining * 1000, remaining });
});
document.querySelector("#pomodoro-reset").addEventListener("click", () => {
  const state = settings.pomodoroState;
  persistPomodoro({ ...state, running: false, endAt: null, remaining: pomodoroDuration(state.mode) });
});
document.querySelector("#pomodoro-skip").addEventListener("click", () => finishPomodoro(true));
for (const [id, key] of [["pomodoro-work", "pomodoroWork"], ["pomodoro-break", "pomodoroBreak"]]) {
  document.querySelector(`#${id}`).addEventListener("change", async (event) => {
    const value = Math.max(1, Math.min(120, Number(event.target.value) || 1));
    settings = await window.cozyClock.updateSettings({ [key]: value });
    const state = settings.pomodoroState;
    if (!state.running && ((key === "pomodoroWork" && state.mode === "focus") || (key === "pomodoroBreak" && state.mode === "break"))) {
      await persistPomodoro({ ...state, remaining: value * 60 });
    }
    renderSettings();
  });
}
document.querySelector("#resize-smaller").addEventListener("click", async () => {
  settings = await window.cozyClock.resizeStep(-1);
  renderSettings();
});
document.querySelector("#resize-larger").addEventListener("click", async () => {
  settings = await window.cozyClock.resizeStep(1);
  renderSettings();
});
document.querySelector("#save-preset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#preset-name");
  input.setCustomValidity("");
  try {
    presets = await window.cozyClock.savePreset(input.value);
    input.value = "";
    renderPresets();
  } catch (error) {
    input.setCustomValidity(String(error.message || error).replace(/^Error invoking remote method '[^']+': Error: /, ""));
    input.reportValidity();
  }
});
document.querySelector("#preset-list").addEventListener("click", async (event) => {
  const remove = event.target.closest("[data-remove-preset]");
  if (remove) {
    presets = await window.cozyClock.removePreset(remove.dataset.removePreset);
    renderPresets();
    return;
  }
  const select = event.target.closest("[data-preset-id]");
  if (select) {
    const result = await window.cozyClock.applyPreset(select.dataset.presetId);
    settings = { ...settings, ...result.settings };
    wallpaper = result.wallpaper;
    renderSettings();
    renderWallpaper(true);
    refreshWeather();
  }
});
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

document.querySelectorAll("[data-window-size]").forEach((button) => {
  button.addEventListener("click", async () => {
    settings = await window.cozyClock.setWindowSize(button.dataset.windowSize);
    renderSettings();
  });
});

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
  const hasBattery = await window.cozyClock.hasBattery();
  if (!hasBattery || !("getBattery" in navigator)) {
    elements.battery.hidden = true;
    return;
  }
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
  refreshWeather();
});

window.cozyClock.getWallpaper().then((savedWallpaper) => {
  wallpaper = savedWallpaper;
  renderWallpaper();
});

window.cozyClock.listPresets().then((savedPresets) => {
  presets = savedPresets;
  renderPresets();
});

window.cozyClock.listMusic().then((savedTracks) => {
  tracks = savedTracks;
  loadTrack(0);
});

updateClock();
setInterval(updateClock, 1000);
setInterval(tickPomodoro, 1000);
monitorBattery().catch(() => {});
