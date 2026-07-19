# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (ADR-CORE-024).

## [Unreleased]

### Added

- ffmpeg/ffprobe discovery — resolves the suite from a settings override, the app-managed install dir
  (`<app_data>/bin`), `PATH`, then platform locations; exposed via the `discover_ffmpeg` command and the
  `FfmpegStatus` binding. Absence is a typed state, not a crash (ADR-PROJ-001, ADR-CORE-037).
- Expanded settings: UI language (`de`/`en`, default German), `ffmpeg`/`ffprobe` path overrides, a
  default output directory, job concurrency (clamped 1–8) and a recursive-scan toggle.
- Internationalization: German (default) and English UI, switchable in Settings — a hand-rolled message
  catalogue (`src/i18n`, 62 keys) and a `useT()` hook that reads the language from settings.
- `Select` HUD primitive — an accessible combobox/listbox replacing the native `<select>` (ADR-APP-026).

- Media pipeline (backend): folder scan (stdlib walk + extension filter), `ffprobe` metadata parsing,
  resolution-based quality rating, and thumbnail generation cached as base64 data URIs — via the
  `scan_folder`, `probe_media` and `get_thumbnail` commands.
- **Library view**: pick or drag-and-drop a folder to scan it; each video is a card with a thumbnail, a
  quality badge (green at ≥1080p) and key metadata. A **Detail view** shows the full technical metadata.
- HUD primitives `Badge`, `Dropzone`, `MetaRow`, `QualityBadge`, `VideoCard`, and formatting helpers
  (`src/lib/format.ts`). New dependency `@tauri-apps/plugin-dialog` (native folder picker).

### Fixed

- Fatal-screen crash path: `showFatal` now keeps the `QueryClientProvider`, so the localized `FatalScreen`
  can read settings instead of throwing "No QueryClient set" on top of the crash it is reporting.
