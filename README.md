# Cozy Clock

A compact, customizable desktop clock for Windows. It floats above other windows, remembers its position, plays a local music library, and expands into a side-by-side editor when you want to change its appearance.

## Features

- Frameless, draggable, resizable, always-on-top clock
- 12-hour and 24-hour time with optional date and seconds
- Cozy color themes and an animated Elden Ring-inspired theme
- Custom JPG, PNG, WEBP, and animated GIF wallpapers
- Adjustable clock color, font, wallpaper darkness, and number panels
- Persistent local music library with playback controls
- Local file import and optional YouTube audio import
- Pomodoro focus and break timer with desktop notifications
- City-based current weather powered by Open-Meteo
- Automatic readable color suggestions from custom wallpapers
- Drag-and-save positioning for clock elements
- Click-through minimal HUD for watching videos (`Ctrl+Shift+H`)
- Directly draggable HUD with hover-wheel sizing and double-right-click exit
- Independent HUD digit color and opacity controls
- Complete saved layouts with their own wallpaper or GIF copy
- Custom Windows app and installer icon

All wallpapers, music, and preferences stay on the user's computer.

## Run locally

```powershell
npm install
npm start
```

## Build the Windows installer

```powershell
npm run dist
```

The installer is written to the `dist` folder.

The YouTube importer is intended only for media you own or have permission to download.
