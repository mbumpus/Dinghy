# Frigate Polygon Helper

A standalone, local-first tool for [Frigate](https://frigate.video) users: upload or paste a camera frame, draw zones and masks visually, and export valid Frigate YAML. No backend, no accounts, no network calls — the entire app is one HTML file that works on an air-gapped network.

**→ Open [`frigate_config_builder.html`](frigate_config_builder.html) in any modern browser. That's the whole install.**

## Why

Frigate zones and masks are defined as normalized polygon coordinates in `config.yml`. Calculating those by hand from a camera frame is tedious and error-prone. This tool lets you draw them.

## Features (v0.2)

### Mask / Zone Editor
- **Load a frame** by drag-and-drop, file picker, or just **Ctrl/Cmd+V** a screenshot of the Frigate debug view
- **Draw** zones (green), motion masks (red), and object filter masks by clicking points; close via the first point, the Close button, or **Enter**
- **Edit visually**: drag any vertex (YAML updates live), click an edge to insert a vertex, double-click a vertex to delete it
- **Keyboard**: `Ctrl/Cmd+Z` undo last point or last vertex move · `Escape` clear draft / cancel drag · `Enter` close polygon
- **Import existing YAML**: paste your `config.yml` (or any snippet) and your zones/masks redraw on the canvas as editable items — legacy pixel-space coordinates are converted automatically
- **Validation** that matches what Frigate accepts: name rules, camera-name collisions, minimum 3 points — inline warnings, never popup dialogs; deletes are instant with a 5-second Undo

### Multi-camera workspace
- A tab strip above the canvas gives every camera its own frame, polygons, and YAML
- YAML scope toggle: **This camera** (paste-ready snippet for an existing camera block) or **All cameras** (complete `cameras:` config)
- Importing a multi-camera config creates the cameras and routes polygons to their own tabs

### Camera Builder
- Define cameras (name, RTSP input, detect resolution, FPS, roles, optional tracked objects)
- Object filter masks support an **"all objects"** option that expands to every tracked type at export
- Drawing a mask for an object type the camera doesn't track produces a friendly warning (never a block)

### Persistence
- Work auto-saves to your browser's localStorage after every change — polygons, cameras, even the in-progress draft
- Images are never stored (by design); after a refresh you're prompted to re-load the frame by name, and your polygons reappear on it
- **Clear All Data** wipes everything, with an undo window

## Privacy / security posture

This is a tool for configuring a security system, so it is built to be audited:

- Single HTML file, no build step, no CDN, no fonts, no analytics, no telemetry
- Zero network requests at runtime — verify in DevTools
- The only third-party code is [js-yaml 4.1.0](https://github.com/nodeca/js-yaml) (MIT), vendored inline and used solely to *parse* YAML you import; generated YAML is plain string templating

## Coordinate model

Origin is top-left. Coordinates are normalized (`x / width`, `y / height`), emitted to 3 decimals as comma-separated pairs — exactly what Frigate's `coordinates:` and `mask:` fields expect. Normalized values are the source of truth internally, so re-loading a frame at a different resolution never shifts your polygons.

## Roadmap

| Version | Status | Scope |
|---------|--------|-------|
| v0.1 | shipped | Core editor, camera builder, live YAML |
| v0.2 | **shipped** | YAML import, point editing, clipboard paste, persistence, multi-camera, validation |
| v0.3 | next | Electron desktop app: open/save `config.yml` directly, grab RTSP frames via FFmpeg |
| v0.4 | planned | ONVIF camera discovery on the local network |

Specs, architecture decisions, and the build audit trail live in [`crewly/`](crewly/).

## Development

There is nothing to build. Edit the HTML file, refresh the browser. A minimal static server for preview tooling lives in `.claude/serve.js` (`node .claude/serve.js` → http://localhost:8741).

The script is organized into plain-object namespaces — `Store` (state + actions), `View` (rendering), `Yaml`, `Validate`, `Persist`, `Platform`, `Importer` — with one rule: UI handlers call `Store` actions only, and rendering/YAML/persistence react via `Store.subscribe`. All I/O goes through the small `Platform` adapter, which is the only layer the v0.3 Electron port replaces.

## License

MIT
