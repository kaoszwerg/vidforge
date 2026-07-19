---
id: rule:media-pipeline
title: Media pipeline conventions (ffmpeg orchestration, non-destructive, egress)
tldr: "ffmpeg/ffprobe via argv arrays (never a shell string); strictly non-destructive output; the only egress is the opt-in ffmpeg installer (ADR-PROJ-001)."
scope: project
load: conditional
triggers:
  [
    ffmpeg,
    ffprobe,
    video,
    media,
    convert,
    encode,
    transcode,
    remux,
    repair,
    thumbnail,
    probe,
    scan,
    quality,
    player,
    stream,
    queue,
    job,
    preset,
    install,
    download,
    egress,
    i18n,
    language,
  ]
applies-to:
  [
    "src-tauri/src/ffmpeg/**",
    "src-tauri/src/media/**",
    "src-tauri/src/jobs/**",
    "src-tauri/src/player/**",
    "src-tauri/src/commands/**",
    "src/views/**",
    "src/components/**",
    "src/i18n/**",
  ]
---

# Media pipeline conventions

Operational rules for Vidforge's video domain. The full rationale is **ADR-PROJ-001**; this is the
checklist an agent touching the pipeline must honour.

- **ffmpeg/ffprobe are external processes.** Spawn them with `tokio::process::Command` and an **argv
  array** — never a shell string, never string interpolation into a command line (ADR-CORE-011). No
  `libav*` linkage, no in-process decoding.
- **Availability is a state, not an assumption.** Resolve the binaries via: settings override →
  `<app_data>/bin/` (managed install) → `PATH` → platform locations. When absent, return the typed
  "not found" state and let the UI offer the installer — **never** panic or silently no-op (ADR-CORE-037).
- **The installer is the only egress, and it is opt-in.** Outbound network access exists **only** in the
  user-initiated ffmpeg installer, which downloads a **pinned** build (URL + SHA-256 in the embedded
  manifest), verifies the hash before use, and writes to `<app_data>/bin/`. Any other outbound flow is
  forbidden without its own ADR (rule:privacy). Download via system `curl`, extract via system `tar`,
  verify via the `sha2` crate — do not add a Rust TLS/zip stack (the licence gate rejects it).
- **Output is strictly non-destructive.** Conversions/repairs write to an output dir; the source file is
  **never** overwritten or replaced. There is no "replace original" path — adding one needs owner consent
  (ADR-CORE-002).
- **Paths come from a scan, validated.** Commands act only on paths produced by `scan_folder` (canonicalised,
  validated), never on an arbitrary path handed in by the frontend. Thumbnails and on-demand transcodes go
  to the **app cache dir**, never beside the source.
- **Jobs never die silently.** Queue workers are registered in `crash-boundaries.json` (ADR-APP-032) with how
  they die; a single job's failure becomes `JobStatus::Failed`, is logged and emitted, and the worker
  continues. Progress comes from `ffmpeg -progress pipe:1`.
- **The player serves only registered files.** The custom `stream` URI scheme maps a session token to a
  validated path and serves byte ranges — it never opens an arbitrary path from the request.
- **Every IPC DTO is `ts-rs`-exported and contract-tested both sides** (ADR-CORE-010); the frontend imports
  the generated binding, never a hand-typed shape (rule:frontend-architecture).
- **All UI strings go through i18n** (`src/i18n`, `t()`), never hardcoded in a view; the active language is
  `SettingsDto.language` (default `de`), the single source (ADR-CORE-005).
- **Every control is a HUD primitive** from `src/components/ui/` (ADR-APP-026): the new ProgressBar, Badge,
  Slider, Select, Dialog and Dropzone are built there, with tests — never a native element in a view.
