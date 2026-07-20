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
- Conversion/repair **job queue** (backend): concurrency-limited workers run one ffmpeg child per job with
  live `-progress` percent, cancel (kills the child + removes the partial output) and `job://update`
  events — strictly non-destructive (output to a `vidforge-out` folder; the source is never overwritten).
  Presets: Universal (MP4/H.264 CRF 18), Efficient (MP4/HEVC), Archive (lossless FFV1/MKV), Repair (remux),
  Custom. Commands `list_presets`/`enqueue_job`/`cancel_job`/`list_jobs`.
- **Status-bar process list** (bottom-right, clickable): running jobs with progress bars + cancel, plus the
  queued/upcoming jobs. Convert/Repair actions on the Detail view. **Bulk multiselect** in the Library
  (click / Ctrl-Cmd-click / Shift-range / Ctrl+A / Escape) with a "Convert selected" action.
- The animated window border energizes while jobs run and settles when the queue drains. New HUD
  `ProgressBar` primitive.
- **In-app ffmpeg installer** — the one deliberate, user-initiated network egress: downloads a pinned
  BtbN build over HTTPS (Windows/Linux) via system `curl`, verifies it against the host's published
  `checksums.sha256`, extracts it via system `tar` and installs `ffmpeg`+`ffprobe` into `<app_data>/bin`,
  with live progress. macOS shows a manual-install (Homebrew) message. Exposed as `install_ffmpeg` and an
  "Install ffmpeg" button in the ffmpeg-missing notice. Verification via the `sha2` crate.
- **Self-cleaning caches**: the thumbnail (128 MB) and prepared-player (2 GB) cache dirs are kept under a
  byte budget by evicting the oldest files at startup, so a long-lived install never grows the cache
  without bound. (A cache hit already avoided the ffmpeg work; this only bounds on-disk size.)
- **Internal player** — a fully HUD-skinned HTML5 `<video>` in the Detail view (no VLC, no separate
  window). `prepare_player` remuxes a web-friendly source (or transcodes others) into a cached MP4 played
  via the asset protocol; custom transport (play/pause, seek, volume/mute, fullscreen) with
  preparing/error states. New HUD `Slider` primitive.

### Changed

- UI/UX pass from a senior design review: the Detail view's metadata is now a capped ~320–400px inspector
  (player pane grows), key→value pairs read as associated pairs (`MetaRow`), colour signals hierarchy
  (File/Video/Audio panels cyan, only the Convert/Repair actions green), the filename renders in normal
  case (not a label), the Dropzone collapses to a compact folder bar once a folder is loaded, the grid
  follows container width (`auto-fill minmax`), each card's metadata is tiered/scannable with the quality
  badge overlaid on the thumbnail, the player's volume slider yields at narrow widths, and loading states
  show a spinner.
- Library cards surface their metadata as colour-coded HUD badges — the resolution tier tinted the same
  accent as the corner quality badge (e.g. green "1080P", gold "720P") and the codec in cyan — with the
  exact dimensions, duration (gold, clock icon) and size (drive icon) demoted to a secondary line, so the
  key facts are scannable at a glance. The search field gained a clear button.
- Player: a source the webview can play as-is — an `.mp4`/`.mov`/`.m4v` holding H.264 with AAC/MP3 (or no)
  audio — is now played **directly from its original file**, with no ffmpeg run, no cache copy and no
  "preparing" wait; the command grants the asset scope just that one file. Only a source the webview
  cannot play (foreign container or codec) is still remuxed/transcoded into the cache. Nothing autoplays.
- **In-app HUD folder browser** replacing the OS-native picker (owner decision): a two-column `Dialog` — a
  lazy, expandable directory **tree** on the left (standard user dirs + drives as roots) and the selected
  folder's sub**folders** on the right, with a clickable breadcrumb and a "Choose this folder" action.
  Backed by read-only `browse_roots`/`browse_dir` commands (folder names only, never file contents). New
  HUD `Dialog` primitive (portal modal, scrim, focus trap, Escape) and a `pathSegments` breadcrumb helper.

### Fixed

- Fatal-screen crash path: `showFatal` now keeps the `QueryClientProvider`, so the localized `FatalScreen`
  can read settings instead of throwing "No QueryClient set" on top of the crash it is reporting.
- UI clipping at the frameless window's chamfered edges: the footer now clears the bottom corners, the
  sidebar clears the top/bottom chamfers, the status-bar jobs popover clamps to the viewport (no overflow
  at narrow widths), and unpadded HUD buttons no longer clip their own label/icon.
- Detail view: the player now occupies the prominent left pane; the redundant thumbnail was removed.
- Library multiselect: a discoverable **checkbox** overlays each card's thumbnail (was Ctrl/Shift-click
  only); the file list gained **search, sort and extension filter**.
- Tooltips flip above the trigger when there is no room below, so footer tooltips are no longer clipped.
- Player transport controls: the seek and volume sliders no longer fight over a shared `w-full` (which
  had collapsed the seek bar to a dot and stretched the volume bar full-width) — each sits in its own
  sizing wrapper; the inline video is height-capped (`max-h-[60vh]`) so on a wide/maximised window it no
  longer grows taller than the viewport and pushes the transport bar (and everything below) off-screen;
  and fullscreen lays the player out as a flex column so the controls stay visible with a clear exit.
- Edge tooltips (e.g. the sidebar): the popover is measured after it mounts and re-placed from its real
  width, so a short label near the left/right edge sits next to its trigger instead of being clamped far
  away from it.
- Library card checkbox: it overlays the thumbnail's top-left corner (via an absolutely-positioned
  wrapper) instead of being laid out in flow and displacing the preview image, and it can no longer
  overhang the card's neon border; the quality badge mirrors it at the top-right.
- Field/section labels (`.hud-label`) no longer wrap to a second line, so a row of labelled controls
  (e.g. the Library search/sort/filter toolbar) keeps its labels on one line and its controls on one
  line instead of one column dropping out of alignment when its label was long (affects every view).
- Library bulk-selection bar: the Preset select (which carries a label above its trigger) and the
  Convert button now share one baseline (`items-end`), so the button no longer sits above the select's
  trigger next to it.
- Button signal colours match their purpose: "Repair" is a **neutral** secondary (it is non-destructive —
  it writes a new file, never the source), not gold; and "clear logs" is **gold** (a caution), not danger,
  since it discards in-memory diagnostics, not user data. (green = confirm, danger = destructive.)

### Removed

- `@tauri-apps/plugin-dialog` and its `dialog:allow-open` capability — the app opens no OS-native dialog
  any more; folder selection is the in-app HUD browser above, and folder listing is read-only.
