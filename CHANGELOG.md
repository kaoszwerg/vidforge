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
