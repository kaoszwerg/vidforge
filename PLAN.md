# Vidforge — implementation plan

A folder-scoped video **repair, convert & preview** tool on the `saga-rust-template` shell. Point it at a
folder → cards with thumbnail, metadata and a quality rating → play in a fully-skinned internal player →
repair / re-encode / convert via a system (or in-app-installed) **ffmpeg**, as non-blocking queued jobs
with live progress. Architecture: **ADR-PROJ-001**; conventions: **rule:media-pipeline**.

## Requirements (owner-stated, locked)

1. Point at a folder → find every video file in it (recursion is a setting).
2. One **card per video**: thumbnail + all obtainable technical metadata (resolution, container, video/
   audio codec, bitrate, fps, …).
3. **Quality rating** badge, green→red by resolution, **green from 1080p**.
4. **Repair** defective videos.
5. **Convert / re-encode** between MP4, MKV, AVI; visually-lossless MP4/H.264 as the 1-click default;
   presets **and** full manual configuration.
6. **% progress** per job.
7. Jobs in a **queue**, non-blocking, run as **subprocesses**.
8. **Auto-detect** a system-installed ffmpeg (and ffprobe / all needed tools).
9. **In-app installer** for the full ffmpeg toolset if the system has none.
10. **Internal, fully HUD-skinned player** on ffmpeg (no VLC), embedded in the detail view — no own window.
11. **UI language de + en**, switchable in Settings, **German default**.
12. **Strictly non-destructive** output (source never replaced).
13. The animated **window border signals background activity** and settles when work is done.
14. A clickable **process list in the footer (bottom-right)** with a **% progress bar per process**; it
    shows the **currently running** job and, when opened, the **queued/upcoming** jobs too.
15. **Bulk processing**: select multiple videos via **multiselect** with the usual OS mouse/keyboard
    mechanics (click, Ctrl/Cmd-click toggle, Shift-click range, Ctrl/Cmd+A select-all), then enqueue the
    whole selection for convert/repair in one action.

Delivery: full feature set in one autonomous pass; committing on `main` is permitted; each landing commit
keeps `check:all` green and bumps SemVer.

## Architecture at a glance

```
Folder ──scan──▶ [paths]     ffmpeg installer (opt-in, pinned+verified) ──▶ <app_data>/bin/
                   │  ffprobe (json)         ffmpeg -ss -frames:v 1
                   ▼                          ▼
              MediaInfo DTO ───▶ VideoCard ◀── thumbnail (app cache)
                   │  (quality rating: green≥1080p … red = lowest)
                   ▼
              Detail view ── internal player (stream:// ⇄ ffmpeg remux/transcode) + actions
                   │
                   ▼   Convert / Repair (PresetSpec)
        JobQueue (tokio, N workers) ── ffmpeg -progress pipe:1 ──▶ % events
                   │                                         │
                   ▼                                         ▼
        StatusBar jobs popover (bottom-right, % bars)   window-border activity signal
```

- **Backend (`src-tauri/src/`)** — thin commands (validate → core → map error), all DTOs `ts-rs`-derived:
  - `ffmpeg/discover.rs` — resolve ffmpeg/ffprobe (settings override → `<app_data>/bin/` → PATH → platform
    dirs); version probe; "not found" is a typed state.
  - `ffmpeg/install.rs` — opt-in installer: pinned per-OS manifest (URL + SHA-256 + archive + inner paths),
    download via system `curl`, SHA-256 verify (`sha2`), extract via system `tar`, into `<app_data>/bin/`;
    progress events. **The one deliberate egress (rule:privacy, ADR-PROJ-001 §2).**
  - `media/probe.rs` — ffprobe JSON → `MediaInfo`. `media/scan.rs` — stdlib recursive walk + ext filter.
    `media/thumbnail.rs` — one frame → app cache. `media/quality.rs` — resolution → tier + colour.
  - `jobs/queue.rs` — concurrency-limited queue, `-progress pipe:1` → percent events, cancel (kill child),
    registered in `crash-boundaries.json`. `jobs/preset.rs` — argv builders.
  - `player/` — session token→path registry + a custom async `stream` URI scheme with range support;
    remux web-friendly / transcode others on demand.
  - `commands/{media,jobs,player,ffmpeg}.rs` — appended to `generate_handler!` in `lib.rs`.
  - `error.rs` — new `AppError` variants; `settings.rs`/`dto.rs` — new fields
    (ffmpeg/ffprobe path, output dir, concurrency, recursive, `language`).
- **Frontend (`src/`)** — TanStack Query (scan/probe/thumbnail/jobs), Zustand (selection/UI), Tauri events
  (progress); IPC only via `src/api/`. New HUD primitives in `src/components/ui/` (**zero new UI deps**):
  ProgressBar, Badge, Slider, Select, Dialog, Dropzone. New `src/i18n/` (de/en + `t()`).

### Quality rating (resolution → colour, green at ≥1080p)

| Height | Tier | Colour token |
| --- | --- | --- |
| ≥ 2160 / 1440 | Excellent | green |
| ≥ 1080 | Good | green |
| ≥ 720 | Fair | gold |
| ≥ 480 | Low | orange (gold→danger) |
| < 480 | Poor | danger |

### Presets (default: visually-lossless MP4/H.264)

Universal (MP4·H.264 CRF≈18·AAC, default) · Efficient (MP4·HEVC / MKV·AV1) · Archive (MKV·FFV1, lossless) ·
Repair (remux `-c copy` + genpts/index rebuild) · Custom (container, codec, CRF, speed, audio, scale, fps).
**Strictly non-destructive** — always to an output dir, source never replaced.

## Phases (each ends green + committed)

### Phase 0 — Foundation (done)
- [x] Identity **Vidforge**/`com.kaoszwerg.vidforge`, v0.1.0, fork+adoption, icon set, `crash_probe` fix.
- [x] Repo reframed (README, memory, PLAN); template artifacts removed; repo renamed `kaoszwerg/vidforge`.
- [x] Slugline "Every format, reforged." wired. `check:all` green.
- [x] ADR-PROJ-001 + rule:media-pipeline (this commit).

### Phase 1 — Settings, i18n, deps, errors, ffmpeg discovery + installer
- [ ] Deps: `tokio` `process`/`io-util`, `tauri-plugin-dialog` 2.7.2, `sha2`; npm `@tauri-apps/plugin-dialog`
      (ui-boundary viewSafe). `SettingsDto` + fields; `AppError` variants; contracts + bindings.
- [ ] `src/i18n/` (de/en, `t()`, language from settings, de default) + tests.
- [ ] ffmpeg discovery + version probe + installer (download/verify/extract) + commands + unit tests.

### Phase 2 — Scan, metadata, quality, thumbnails, Library + Detail views
- [ ] `scan_folder`/`probe_media`/`get_thumbnail`/quality + DTOs + tests (probe-JSON fixture, `testsrc`
      integration test). Primitives: ProgressBar, Badge, Slider, Select, Dialog, Dropzone (+ tests).
- [ ] Library view (folder picker via dialog + drag-drop, grid of VideoCards, quality pill), Detail view
      (full metadata + player mount + actions), loading/empty/error states.

### Phase 3 — Queue, presets, convert & repair
- [ ] JobQueue + concurrency + `-progress` percent + cancel + crash-boundary; preset argv builders;
      `enqueue_job`/`cancel_job`/`list_jobs`. Integration test: convert `testsrc`→MP4/H.264, re-probe;
      repair remux round-trip.
- [ ] StatusBar **jobs popover (bottom-right, % bars)** + window-border activity signal wired to job state.

### Phase 4 — Internal player
- [ ] `stream` URI scheme + range serving + remux/transcode negotiation; fully-skinned transport
      (play/pause/seek/volume/time/fullscreen-in-panel) over `<video>` in the detail view; tests.

### Phase 5 — Proof
- [ ] `gen:types` + `check:all` green; launch the app and **drive** scan → play → convert → 100% → verified
      non-destructive output; evidence captured (rule:verification). Version bump + CHANGELOG.

## Testing & verification

Unit per module (both sides); contract tests pin every binding field; Rust integration tests against a
temp dir with an ffmpeg-generated `testsrc` sample (never the real user location); end-to-end drives the
real app. Coverage + the full gate green before "done". Cross-platform: e2e-verified on Windows here;
macOS/Linux paths implemented + unit-tested, flagged where not e2e-verified (rule:cross-platform).

## Non-goals / deferred

- Bundling ffmpeg (GPL redistribution) — installer downloads instead. Signing/notarisation — no secrets.
- Editing/trimming/filtering beyond repair & format conversion — out of scope unless the owner asks.
