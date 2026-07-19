---
id: mem:project-scope
title: Vidforge scope summary
tldr: "Folder-scoped video repair/convert tool (Tauri 2 + React HUD) on a system ffmpeg with a job queue. Leaf; consumes core+app, owns no layer."
scope: project
load: core
type: project
---

# Vidforge — scope summary

**One-line:** Vidforge is a cross-platform (Windows/macOS/Linux) desktop tool that is pointed at a folder,
lists every video inside it as a card (thumbnail + full technical metadata), and **repairs, re-encodes and
converts** those videos between MP4, MKV and AVI — driven by a **system-installed ffmpeg** it discovers on
its own, with all work running as non-blocking jobs in a queue that reports live per-job progress.

Built on the `saga-rust-template` shell (the HUD window, logging, settings, identity, quality gate); the
video functionality is the product layered on top of it.

## Its place in the governance cascade (ADR-CORE-033)

```
kaoszwerg/althing            owns 'core'  (stack-agnostic)
   └── kaoszwerg/saga-rust-template   owns 'app'  (the Tauri/React/HUD shell)
          └── kaoszwerg/reenc (Vidforge)   ← this repo — LEAF, owns no layer
```

This repo is a **consumer only** (a leaf):

- It **consumes** the agnostic `core` (from `althing`) and the `app` layer (from `saga-rust-template`).
  Every file either layer owns is **read-only here** — an in-place edit is drift. Improve it upstream and
  `npm run governance:update`, or diverge the legal way (rule:upstream-changes).
- It **owns no published layer.** `governance/config.json` records `upstream: kaoszwerg/saga-rust-template`
  and no `layer`/`owns`. `governance:sync` re-pins nothing here; it only regenerates the local indexes.
- **Governance for Vidforge goes in the project line** — `.claude/rules/project/`, `docs/adr/project/`
  (`ADR-PROJ-NNN`), `scripts/project/` — never in a core/app file (the drift-gate blocks it).

## External runtime dependency: ffmpeg

Vidforge shells out to a **system-installed `ffmpeg`/`ffprobe`** — it is **not** bundled (that would carry
GPL/LGPL redistribution obligations and needs its own ADR before it happens). The backend discovers the
binaries on `PATH` and in the platform's usual install locations, and a manual override path lives in
settings. Every conversion/repair/metadata read is a child process; nothing decodes video in-process.

## What exists today (inherited from the shell)

- Frameless HUD window, sidebar rail, status bar, About dialog; persisted geometry; optional tray.
- Typed IPC surface with `ts-rs`-generated bindings; `tracing` logging (console + rotating JSON + live UI
  buffer); atomically-persisted JSON settings; crash boundaries on both runtimes (ADR-APP-032).
- Single-source app identity (`app.identity.json` → `identity:sync`, ADR-APP-031).

## What is being built (see `PLAN.md`)

Folder scan + video discovery, `ffprobe` metadata + thumbnail cards, a job queue with live progress, and
repair/convert commands with presets (default: visually-lossless MP4/H.264). The architecture is recorded
in `docs/adr/project/` as it lands.

**Why:** Vidforge is a product now, not the template it was forked from — stating that here (and its leaf
position) stops a later agent from editing upstream core/app files, re-deriving the cascade, or drifting
scope beyond video repair/convert.

**How to apply:** before adding anything, check it against this file and `PLAN.md`. Video repair/convert
functionality and its supporting infrastructure belong here; anything that is really a *shell* improvement
(window chrome, logging, the design system) belongs upstream in `saga-rust-template`, not in this project.
