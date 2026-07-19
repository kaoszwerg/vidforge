---
id: ADR-PROJ-001
title: Video domain architecture — ffmpeg-backed pipeline, internal player, non-destructive output, i18n
status: accepted
date: 2026-07-19
tldr: "ffmpeg/ffprobe run as external processes (discovered or in-app installed); job queue, internal <video> player, strictly non-destructive output, de/en UI."
scope: project
load: conditional
triggers:
  [
    video,
    media,
    ffmpeg,
    ffprobe,
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
    locale,
  ]
applies-to:
  [
    "src-tauri/src/ffmpeg/**",
    "src-tauri/src/media/**",
    "src-tauri/src/jobs/**",
    "src-tauri/src/player/**",
    "src-tauri/src/commands/**",
    "src/views/**",
    "src/i18n/**",
  ]
supersedes: []
---

## Context

Vidforge is a folder-scoped video **repair, convert & preview** tool built on the `saga-rust-template`
shell (ADR-APP-001). It must: scan a folder for videos; show a card per file with a thumbnail, full
technical metadata and a resolution-based quality rating; play a video in a fully HUD-skinned internal
player (no separate window); and repair / re-encode / convert between MP4, MKV and AVI as non-blocking
queued jobs with live progress. All heavy media work is done by **ffmpeg** — the app orchestrates it, it
does not decode video in-process. The maintainer's decisions (recorded here, not re-litigated): internal
ffmpeg player (no VLC), strictly non-destructive output, German+English UI switchable in settings
(German default), and an in-app ffmpeg installer for systems without one.

## Decision

### 1. ffmpeg is an external process — discovered, or installed on request

- The backend shells out to `ffmpeg` and `ffprobe` via `tokio::process::Command` (argv arrays only, **never**
  a shell string — no injection surface, ADR-CORE-011). No in-process decoding, no `libav*` linkage.
- **Discovery** order: an explicit settings override path → the app-managed install dir
  (`<app_data>/bin/`) → `PATH` → the platform's usual install locations. "Not found" is a **first-class,
  user-visible state**, never a crash (ADR-CORE-037): every media feature checks availability first and the UI
  offers the installer.
- **Not bundled.** Shipping ffmpeg inside the installer would carry GPL/LGPL redistribution obligations
  (rule:dependencies); Vidforge redistributes nothing.

### 2. In-app ffmpeg installer — the one deliberate network egress (ADR-CORE-011, rule:privacy)

Vidforge is otherwise **local-first with zero egress**. The installer is the single, **explicit, opt-in,
user-initiated** outbound flow, and it exists only to fetch the ffmpeg toolset (ffmpeg **and** ffprobe, and
any sibling tool a feature needs) when the system has none:

- **User-initiated only.** Triggered by a button in the "ffmpeg not found" UI — never automatic, never
  silent, never on launch.
- **Pinned + verified.** The download URL is pinned per OS/arch; the archive is verified against the build
  host's own `checksums.sha256`, fetched over HTTPS at install time — a rolling "latest" build cannot carry
  a hash pinned in the binary, so the trust anchor is the host's published checksum over TLS. A SHA-256
  mismatch aborts, discards the file, and is surfaced. Windows and Linux use BtbN's static GPL builds;
  macOS has no such build, so it degrades to a clear "install manually" message (Homebrew) — a first-class
  state (ADR-CORE-037), tracked as a follow-up.
- **Mechanism, dependency-light.** Download via the system `curl` (TLS via the OS), extract via the system
  `tar` (bsdtar handles `.zip` on Windows/macOS; GNU `tar` handles `.tar.xz` on Linux), verify with the
  pure-Rust `sha2` crate. No Rust TLS/zip stack is added (a Rust TLS client would pull an OpenSSL-licensed
  crate that `deny.toml` forbids). Binaries land in `<app_data>/bin/` and are recorded as the managed path.
- **Disclosed.** What is downloaded, from where, and that nothing else leaves the device is stated in the
  UI and here. Any *other* egress remains forbidden without its own ADR.

### 3. Metadata, scan, thumbnails, quality

- `scan_folder` walks a chosen folder (recursion is a setting) for known video extensions using `std::fs`
  (no `walkdir` dependency — stdlib suffices). Paths are canonicalised and validated; a scanned path is the
  only thing later commands will act on (no arbitrary path from the frontend).
- `probe_media` runs `ffprobe -v quiet -print_format json -show_format -show_streams` and parses it into a
  `MediaInfo` DTO (container, duration, size, bitrate; video/audio/subtitle streams).
- Thumbnails are one representative frame extracted by ffmpeg into the **app cache dir** (never beside the
  source), keyed by path+mtime+size.
- **Quality rating** is resolution-based per the owner's spec: green at ≥1080p, ramping through gold/orange
  to red below (2160/1440/1080 → green tiers, 720 → fair, 480 → low, <480 → poor). Resolution only;
  bitrate/codec may refine it later (noted, not assumed — ADR-CORE-004).

### 4. Jobs — non-blocking queue with progress and cancel

- A `JobQueue` in managed state runs conversions/repairs as ffmpeg child processes with configurable
  concurrency. Progress is parsed from `ffmpeg -progress pipe:1` (`out_time_us` ÷ duration → percent) and
  streamed to the UI via Tauri events. Jobs are cancellable (kill child). States: Queued / Running(%) /
  Done / Failed / Cancelled. The worker task(s) are registered in `crash-boundaries.json` (ADR-APP-032): a
  worker never dies silently on a single job's failure — it records it and continues.
- **Presets** build ffmpeg argv: **Universal** (MP4/H.264 CRF≈18/AAC — the visually-lossless 1-click
  default), Efficient (HEVC/AV1), Archive (lossless FFV1), Repair (remux `-c copy` + genpts/index rebuild),
  and Custom. Output is **strictly non-destructive**: always written to an output dir, the source is
  **never** overwritten or replaced — there is no "replace original" path (owner's decision).

### 5. Internal player — ffmpeg-fed HTML5 `<video>`, no VLC, no separate window

- The player is an HTML5 `<video>` element embedded in the video **detail view** — 100% HUD-skinned
  controls, no VLC, no OS window. Video is served to the webview through a **custom asynchronous Tauri URI
  scheme** (`stream`) with HTTP **range** support, so seeking works.
- The stream backend negotiates per source: a **web-playable** source (H.264/AAC in a compatible container)
  is served by remux/`-c copy` or directly; anything else is **transcoded on demand** to H.264/AAC. The
  handler only ever serves a path validated against the current session's registered playable files
  (token → path map) — no arbitrary file access via the protocol.
- Rejected: **VLC/libVLC overlay** (a native child window over a DOM hole) — best any-format seeking without
  transcoding, but platform-specific native code, weak on Linux WebKitGTK, and a heavy extra dependency. The
  internal player reuses ffmpeg, keeps the video truly in the DOM (fully skinnable), and removes the
  riskiest cross-platform work.

### 6. Internationalisation — de/en, switchable, German default

- A minimal in-house i18n layer (`src/i18n/`: typed `de`/`en` message tables + a `t()` hook) — no i18n
  dependency for a two-language app (rule:dependencies). The active language is a field on the persisted
  `SettingsDto` (`language`, default `"de"`) — one source of truth (ADR-CORE-005), changed in Settings.

### 7. Background activity is signalled by the window border

The shell's animated conic window border (`window-frame`) reflects background work: it energises while any
job/scan/thumbnail/install runs and settles to idle when the queue drains — a single ambient indicator
driven by an "is any work active" selector, not per-feature chrome.

## Alternatives considered

- **libVLC player** — see §5. **HTML5 `<video>` on the raw file** — fails on MKV/HEVC/AVI/exotic inputs
  (the very files this tool exists for), so a decode/transcode layer is required. **Bundling ffmpeg** — GPL
  redistribution (§1). **An i18n library** — overkill for two languages (§6). **`walkdir`/`zip`/`reqwest`
  crates** — avoided; stdlib + system tools cover scan/extract/download without the dependency (and the TLS
  stack trips the licence gate).

## Consequences

- ffmpeg's presence is a runtime concern surfaced in the UI; the installer adds one governed egress that
  must stay opt-in and verified.
- The custom stream protocol and the CSP change to allow it (`media-src`) are new attack surface — hence the
  token→path validation and range-only serving.
- Non-destructive-only means "replace original" is intentionally absent; re-adding it would need a new
  decision (owner consent, ADR-CORE-002).
- New DTOs pin new IPC contracts (tested both sides, ADR-CORE-010). New backend deps: `tauri-plugin-dialog`
  (folder picker), `sha2` (download verification), and the `tokio` `process`/`io-util` features.

## References

ADR-APP-001 (stack), ADR-APP-026 (no native UI), ADR-APP-032 (crash handling), ADR-CORE-011 (security),
ADR-CORE-037 (no silent death), ADR-CORE-005 (SSOT), ADR-CORE-009 (dependencies), rule:privacy, rule:media-pipeline,
`PLAN.md`.
