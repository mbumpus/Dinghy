<p align="center"><img src="dinghy.png" alt="Dinghy" width="128"></p>

# Dinghy

**Dinghy gets you into [Frigate](https://frigate.video).** Draw zones and masks visually on your camera frames, manage cameras, and export valid Frigate YAML — fully local, no accounts, no telemetry, works on an air-gapped network.

## Two ways to run it

**Desktop app (v0.3)** — native file access and RTSP frame capture:

```bash
npm install
npm start          # launch Dinghy
npm run dist       # package installers (dmg / AppImage / exe via electron-builder)
```

**Browser (zero install)** — open [`dinghy.html`](dinghy.html) in any modern browser. Every editing feature works; only the desktop-native extras (config file I/O, RTSP grab) are absent.

## Features

### Editor
- **Load a frame** by drag-and-drop, file picker, **Ctrl/Cmd+V** paste — or, in the desktop app, click **Grab Frame from RTSP** to pull a still straight from the active camera's stream (requires `ffmpeg` on your PATH)
- **Draw** zones (green), motion masks (red), and object filter masks by clicking points; close via the first point, the Close button, or **Enter**
- **Edit visually**: drag any vertex (YAML updates live), click an edge to insert a vertex, double-click a vertex to delete it
- **Keyboard**: `Ctrl/Cmd+Z` undo point/move · `Escape` clear draft or cancel drag · `Enter` close polygon
- **Import existing YAML**: paste your `config.yml` (or use File → Open Config… in the desktop app) and your zones/masks redraw as editable polygons; legacy pixel-space coordinates convert automatically
- **Validation** matching what Frigate accepts — inline warnings, never popup dialogs; deletes are instant with a 5-second Undo

### Multi-camera workspace
- Camera tab strip above the canvas: each camera keeps its own frame, polygons, and YAML
- YAML scope toggle: **This camera** (paste-ready snippet) or **All cameras** (complete `cameras:` config)
- Importing a multi-camera config creates the cameras and routes polygons to their tabs

### Desktop extras (v0.3)
- **File → Open Config…** loads a real `config.yml` through the importer and remembers the path
- **File → Save Config / Save Config As…** writes the generated full config to disk (v0.3 writes Dinghy's generated config; merging into untouched keys of an existing file is planned)
- **Grab Frame** spawns system `ffmpeg` for a single RTSP frame (15s timeout, credentials never logged); a clear error appears if ffmpeg is missing

### Persistence
- Work auto-saves to localStorage — polygons, cameras, even the in-progress draft. Images are never stored; after a refresh you're prompted to re-load the frame and polygons reappear.

## Privacy / security posture

Built to be audited, since it configures a security system:
- Zero network requests at runtime (web and desktop) — verify in DevTools
- Renderer is one HTML file; the only third-party code in it is [js-yaml 4.1.0](https://github.com/nodeca/js-yaml) (MIT), vendored inline, used only to *parse* imported YAML
- Electron shell: `contextIsolation` on, `nodeIntegration` off, sandboxed renderer; the entire native surface is four functions in [`src/preload.js`](src/preload.js)
- RTSP URLs are passed as process arguments (never shell-interpolated) and stripped of credentials in any error output

## Coordinate model

Origin top-left; coordinates normalized (`x / width`, `y / height`), emitted to 3 decimals as comma-separated pairs — exactly Frigate's `coordinates:` / `mask:` format. Normalized values are the internal source of truth, so reloading a frame at a different resolution never shifts polygons.

## Roadmap

| Version | Status | Scope |
|---------|--------|-------|
| v0.1 | shipped | Core editor, camera builder, live YAML |
| v0.2 | shipped | YAML import, point editing, clipboard paste, persistence, multi-camera, validation |
| v0.3 | **shipped** | Electron desktop app: config.yml open/save, FFmpeg RTSP frame grab, Dinghy branding |
| v0.4 | next | ONVIF camera discovery on the local network |

Specs, architecture decisions, and the build audit trail live in [`crewly/`](crewly/).

## Development

No build step for the renderer: edit `dinghy.html`, refresh. The script is organized into plain-object namespaces — `Store` (state + actions), `View`, `Yaml`, `Validate`, `Persist`, `Platform`, `Importer` — with one rule: UI handlers call `Store` actions only; rendering, YAML, and persistence react via `Store.subscribe`. Native capability enters exclusively through the `window.dinghyNative` bridge and is guarded everywhere, so the same file runs in a plain browser.

Main process: [`src/main.js`](src/main.js) (window, menu, config I/O, ffmpeg spawn). Preview server for browser testing: `node .claude/serve.js` → http://localhost:8741.

## License

MIT
