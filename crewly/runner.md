# Crewly Runner — Complete

**Spec:** Frigate Polygon Helper v0.2 (8-spec milestone run)
**Manifest:** crewly/RUN_MANIFEST.json
**Iterations:** 1 of 5 (no QA rejections)
**Final Verdict:** APPROVED
**Traceability:** Enabled (19 entries in crewly/trace.jsonl)
**Completed:** 2026-06-11

## Files Created / Modified
| File | Size | Purpose |
|------|------|---------|
| frigate_config_builder.html | ~103KB (incl. 39.4KB vendored js-yaml 4.1.0) | The entire v0.2 app, single file |
| crewly/trace.jsonl | 19 entries | DevCrew/QA/Morgan audit trail |
| crewly/bugs.yaml | [] | No bugs survived to registry; one QA test-script artifact (moveUndo assertion) re-verified clean |
| .claude/serve.js, .claude/launch.json | — | Static preview server used for browser QA (dev tooling, not shipped) |

## Spec Results (locked build order)
| # | Spec | Verdict | Morgan Alignment |
|---|------|---------|------------------|
| 01 | State refactor (Store/View/Yaml/Validate/Persist/Platform, normalized-canonical coords) | APPROVED | ALIGNED |
| 02 | Validation & warnings (inline errors, warn banner, undo toast, zero alert()) | APPROVED | — |
| 03 | Clipboard image paste (focus-guarded, replace-with-undo) | APPROVED | — |
| 04 | localStorage persistence (debounced, no image bytes, Clear All Data, migrate-or-discard) | APPROVED | — |
| 05 | Point editing (drag/insert/delete vertices, Ctrl+Z / Escape / Enter) | APPROVED | — |
| 06 | YAML import (vendored js-yaml, pixel→normalized, merge+rename, all-or-nothing) | APPROVED | ALIGNED |
| 07 | Object filter masks full ('all objects' expansion, track-awareness warning) | APPROVED | — |
| 08 | Multi-camera workspace (tab strip, per-camera state, scoped YAML, v2→v3 migration) | APPROVED | ALIGNED |

## v0.2 Exit Criteria (master spec) — all verified in live browser
- [x] Paste existing YAML → polygons redrawn (incl. pixel-space legacy conversion, multi-camera configs)
- [x] Drag points to edit (plus edge-insert, double-click delete, move undo, bounds clamp)
- [x] Paste an image from clipboard (text-paste passthrough preserved)
- [x] Work persists across refresh (cameras, polygons, drafts, active tab; image re-upload prompt)
- [x] Multiple cameras in one workspace (zero cross-camera leakage verified)
- [x] Validation prevents bad YAML (names, collisions, min points; warn-only range/track rules)

## Browser QA Evidence (Claude Preview, served locally)
- Camera add + duplicate-name block + tracked objects → correct
- Zone close blocked on invalid name "Drive Way", accepted as "driveway"
- 'all objects' mask expanded to tracked types only, with provenance comment
- Import: created back_yard from config (input/detect/roles/track), converted 100,10,180,10,180,60 → 0.5,0.1,0.9,0.1,0.9,0.6 on 200×100 image, renamed colliding zone driveway→driveway_2, rejected garbage input with zero state change
- Drag to (1.4,−0.2) clamped to (1,0); undoLastMove restored origin; edge insert and min-3 delete guard correct
- Full reload: workspace restored at schemaVersion 3, no `data:image` in storage, zero console errors/warnings

## Notes for v0.3 (Electron)
- Swap surface is exactly the `Platform` namespace (readImageFile / copyText / downloadFile) plus a future `Platform.readConfigFile`/`writeConfigFile` pair for Importer round-trips.
- `Importer.parse` is pure and reusable for file-system config loading unchanged.
