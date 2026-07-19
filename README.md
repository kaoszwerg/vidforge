# Vidforge

**Every format, reforged.**

Point Vidforge at a folder and it lists every video inside it as a card — thumbnail plus full technical
metadata (resolution, container, video and audio codecs, bitrate, frame rate and more). From there you can
**repair** defective files and **re-encode or convert** them between MP4, MKV and AVI, with a one-click
visually-lossless MP4/H.264 default and fully configurable presets. Conversions run as non-blocking
background jobs in a queue with live per-job progress, driven by a **system-installed ffmpeg** that Vidforge
detects automatically.

## Status

In development. The application **shell** is complete — frameless HUD window, navigation rail, Logs /
Settings views, About dialog, tray icon, live log streaming, JSON-persisted settings, crash handling and the
full governance + quality pipeline. The video functionality (folder scan, metadata cards, thumbnails, the
job queue, repair/convert) is being built on top of it; the roadmap is in [`PLAN.md`](PLAN.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Desktop shell | [Tauri 2](https://tauri.app) (system WebView, frameless HUD window) |
| Backend | Rust — logging (`tracing`), settings (atomic JSON), typed commands, ffmpeg orchestration |
| Frontend | React 19 + TypeScript + Vite, Tailwind 4, Zustand, TanStack Query |
| Media | System `ffmpeg` / `ffprobe` (discovered at runtime — not bundled) |
| Type safety | `ts-rs` generates the TS boundary types from the Rust DTOs (single source of truth) |
| Quality | ESLint, Prettier, Vitest, Clippy, rustfmt, knip, secretlint, cargo-deny, cargo-audit |
| Governance | ADRs, rules and repo-resident memory with generated, hash-checked indexes |

## Getting started

### Prerequisites

- **Node.js ≥ 22** and npm
- **Rust** (stable) with the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) for your
  platform
- **ffmpeg** and **ffprobe** on your `PATH` (or set an explicit path in Settings). Install from
  [ffmpeg.org](https://ffmpeg.org/download.html), or via `winget install ffmpeg` / `brew install ffmpeg` /
  your distro's package manager.

### Run

```bash
npm install
npm run app:dev     # dev build — own identifier, DEV badge in the title bar
```

The first run compiles the Rust backend and writes `src-tauri/Cargo.lock`; commit that file.

### Build

```bash
npm run app:build   # installers under src-tauri/target/release/bundle/
```

### Quality gate

```bash
npm run check:all
```

Runs version + identity sync checks, typecheck, ESLint, Prettier, Vitest, knip, secretlint, the governance
checks, rustfmt, Clippy, the Rust tests, cargo-deny and cargo-audit. Pre-commit hooks (husky + lint-staged)
enforce the same rules — never bypass them with `--no-verify`.

## Layout

```
src/                 React frontend — views, components, hooks, store, styles
  api/commands.ts    typed wrappers around the Tauri commands
  bindings/          GENERATED from the Rust DTOs (npm run gen:types)
src-tauri/src/       Rust backend
  lib.rs             app assembly: plugins, state, tray, command surface
  logging.rs         tracing -> console + rotating JSON file + live UI stream
  settings.rs        atomically persisted JSON settings
  commands/          the IPC surface
docs/adr/            architecture decision records (+ generated index)
  project/           Vidforge's own ADRs (ADR-PROJ-NNN)
.claude/             rules and repo-resident memory (+ generated indexes)
scripts/             governance and version tooling
```

## Governance

Vidforge is a **leaf** in a three-layer governance cascade: it consumes the stack-agnostic `core` (from
`althing`) and the Tauri/React/HUD `app` layer (from `saga-rust-template`), and owns no published layer. Those
upstream files are read-only here; Vidforge's own rules and ADRs live in the project line
(`.claude/rules/project/`, `docs/adr/project/`). See [`.claude/memory/project-scope.md`](.claude/memory/project-scope.md)
and `CLAUDE.md`.

## Adding a feature

1. Backend: a module under `src-tauri/src/`, its DTOs in `dto.rs`, its commands in `commands/`.
2. `npm run gen:types` to regenerate the TypeScript bindings.
3. Frontend: a view under `src/views/`, one entry in the sidebar nav, one branch in `App.tsx`.
4. Tests on both sides, an ADR under `docs/adr/project/` if the decision is structural, then
   `npm run check:all`.

## Licence

Private and proprietary — see [LICENSE](LICENSE).
