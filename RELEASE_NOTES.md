# Dinghy v0.4.0

**Dinghy gets you into Frigate.** Draw zones and masks visually, manage cameras, and export valid Frigate YAML — fully local, no accounts, no telemetry. This release bundles the v0.2–v0.4 milestones into the first packaged desktop build, plus a full security/QA hardening pass.

## Highlights

### ONVIF camera discovery (new in v0.4)
- **Discover Cameras (ONVIF)** finds cameras on your LAN via WS-Discovery in under 5 seconds
- Enter a discovered camera's credentials to pull its real stream profiles; one click fills the Camera Builder with the exact RTSP URL, resolution, and FPS
- Discovery only — no PTZ, no device configuration; non-ONVIF cameras use manual entry as before

### Desktop app (v0.3)
- Native Electron app for macOS/Windows/Linux; the same `dinghy.html` still runs in any browser with every editing feature
- **File → Open Config…** loads your real `config.yml` through the importer; **Save Config / Save Config As…** writes the generated config back to disk
- **Grab Frame from RTSP** pulls a still from the active camera via system `ffmpeg` (15s timeout, credentials never logged)

### Editor (v0.2)
- **Import existing YAML** — zones, motion masks, and object filter masks redraw as editable polygons; legacy pixel-space coordinates convert automatically
- **Visual point editing** — drag vertices with live YAML updates, click an edge to insert, double-click to delete; Ctrl/Cmd+Z, Escape, Enter shortcuts
- **Multi-camera workspace** — per-camera frames, polygons, and YAML behind a tab strip; scope toggle between a paste-ready snippet and a full `cameras:` config
- **Clipboard paste** (Ctrl/Cmd+V a screenshot), **auto-save** across sessions (images never stored), inline validation with instant-delete-plus-undo instead of dialogs
- **"All objects" filter masks** with export-time expansion, and warnings when a mask targets an object the camera doesn't track

## Security & hardening
- Strict Content-Security-Policy: no remote scripts, no network access at runtime (web and desktop)
- Electron 42.4.0; `npm audit` reports zero vulnerabilities
- Sandboxed renderer with `contextIsolation`; the entire native surface is six functions in `src/preload.js`
- All imported YAML values escaped and type-coerced before rendering (XSS fixed); RTSP/ONVIF credentials are never stored in app state and are stripped from all error output
- 16 findings from an independent external QA pass fixed and verified, including cross-camera undo integrity and persistence-clearing correctness

## Verification status
- **macOS build verified** (Dinghy-0.4.0 DMG)
- **ONVIF/RTSP behavior depends on camera, vendor, and network conditions** — discovery and frame grab are implemented to spec but real-world results vary by device
- **Windows/Linux installers require host-specific smoke validation** before distribution

## Requirements
- RTSP frame grab requires `ffmpeg` on your PATH (`brew install ffmpeg` / `apt install ffmpeg`)
- ONVIF discovery requires UDP multicast on your LAN; macOS may prompt for Local Network permission on first use
- Browser mode: any modern browser, zero install — open `dinghy.html`

## Known limitations
- **Save Config** writes Dinghy's generated config; merging into untouched keys of an existing file is planned
- Discovery probes the default network interface only
- Touch input is not supported (desktop-first tool)
