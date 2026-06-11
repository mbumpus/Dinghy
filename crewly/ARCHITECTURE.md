# Frigate Polygon Helper — v0.2 Locked Architecture

**Authority:** Morgan (spec authority) · **Date:** 2026-06-11 · **Status:** LOCKED pending human review
**Source roadmap:** frigate_polygon_helper_master_spec.md · **Baseline:** frigate_config_builder.html (v0.1, 808 lines, shipped)

## Non-Negotiable Constraints (inherited from master spec)

1. Single HTML file. No build step, no bundler, no framework. Vanilla JS + Canvas API.
2. Zero network calls. Works air-gapped. No analytics, no telemetry.
3. No canvas library (Fabric/Konva). Raw Canvas API only.
4. Design every I/O touchpoint behind a `Platform` adapter so Electron IPC (v0.3) swaps in without UI rewrites.
5. Default object list is fixed: person, car, dog, cat, bird, package (+ `all` in v0.2).

## Locked Module Layout (inside the single `<script>` block)

v0.1 is global mutable state with direct DOM calls. v0.2 reorganizes the script into six
plain-object namespaces. **No ES modules, no classes required — just disciplined sections:**

```
Store      — single workspace state object + mutation actions + subscribe(fn) pub/sub
View       — canvas rendering, DOM list rendering, toast/warning rendering (pure reads of Store)
Yaml       — generateYaml(workspace), parseYaml(text) -> ImportResult
Validate   — rule functions returning {level: 'error'|'warn', message} arrays
Persist    — save(workspace)/load() against localStorage, schemaVersion-aware
Platform   — adapters: readImageFile, pasteImage, copyText, downloadFile
             (the ONLY layer Electron v0.3 replaces)
```

**Rule:** UI event handlers call `Store` actions only. `Store` notifies subscribers.
`View.render()` and `Yaml` regeneration are subscribers. No handler touches `items`/`cameras` directly.

## Locked State Model (schemaVersion: 2)

```js
workspace = {
  schemaVersion: 2,
  activeCameraId: "cam_xxx" | null,
  cameras: [{ id, name, input, width, height, fps, roles: [] }],
  // polygons are PER-CAMERA in v0.2 (keyed by cameraId); "default" pseudo-camera
  // holds polygons drawn before any camera exists (v0.1 migration target)
  polygonsByCamera: { [cameraId]: [Polygon] },
  imagesMeta: { [cameraId]: { w, h, filename } }   // dims only — never image bytes
}

Polygon = {
  id: "p_" + crypto.randomUUID(),
  name, type: "zone" | "motion_mask" | "object_filter_mask",   // renames v0.1 'mode'/'object_mask'
  objectType: "person"|"car"|"dog"|"cat"|"bird"|"package"|"all"|undefined,
  points: [{ x, y }],   // normalized 0–1 floats are CANONICAL; pixel coords derived at render
  closed: true
}
```

**Key change from v0.1:** normalized `x,y` become the source of truth; `px,py` are computed
from current image dims at render time. This is what makes point-dragging, YAML import, and
re-upload of a different-resolution screenshot all work without coordinate drift.

## Locked Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Vendor minified js-yaml (~40KB) inline in the HTML for YAML *parsing* (import). Generation stays hand-rolled string templates. | Real-world configs have anchors, comments, odd indentation. A homegrown parser will silently corrupt user configs. Vendoring keeps single-file + air-gap intact. |
| D2 | Normalized coords canonical; pixels derived. | See above. Eliminates the v0.1 frozen-at-click-time bug class. |
| D3 | Inline warnings + 5s undo toast replace all `alert()`/`confirm()`. | Master spec UI principle #6. |
| D4 | localStorage stores workspace JSON only, never image bytes; per-camera image meta prompts re-upload. | Master spec v0.2 §4; 5MB localStorage quota. |
| D5 | Multi-camera UI = horizontal camera tab strip above canvas; "+ Camera" jumps to Camera Builder tab. | Cheapest layout change preserving the 3-column hero-canvas grid. |
| D6 | Build order is dependency-driven (below). Foundation refactor ships first and alone. | Every other feature touches state; refactor-last means refactor-everything. |

## Locked Build Order

| Order | Spec file | Feature | Pts | Depends on |
|-------|-----------|---------|-----|------------|
| 1 | 01-state-refactor.json | Store/View/Platform refactor + v0.1 data migration | 5 | — |
| 2 | 02-validation-warnings.json | Validation rules + inline warnings + toast/undo system | 3 | 01 |
| 3 | 03-clipboard-paste.json | Image paste from clipboard | 2 | 01 |
| 4 | 04-localstorage-persistence.json | Workspace persistence + restore + Clear All | 3 | 01, 02 |
| 5 | 05-point-editing.json | Drag points, insert point on edge, keyboard shortcuts | 5 | 01, 02 |
| 6 | 06-yaml-import.json | Paste/upload existing config.yml → redraw polygons | 5 | 01, 02 (D1 js-yaml) |
| 7 | 07-object-filter-mask-full.json | "all objects" mask + objects.track warning | 2 | 02 |
| 8 | 08-multi-camera-workspace.json | Camera tabs, per-camera polygons/images/YAML | 8 | 01, 02, 04 |

Total: 33 points across 8 specs. Specs 03/04/05 and 06/07 are parallelizable after their deps land.

## v0.2 Exit Criteria (from master spec, restated)

1. Paste existing YAML → polygons redrawn. 2. Drag points to edit. 3. Paste image from clipboard.
4. Work survives refresh. 5. Multiple cameras in one workspace. 6. Bad YAML blocked by validation.
