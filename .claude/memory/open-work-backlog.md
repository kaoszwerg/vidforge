---
id: mem:open-work-backlog
title: Open follow-up work on Vidforge
tldr: "Backlog: v0.7.0 feature-complete; follow-ups: macOS installer, streaming transcode, custom UI, signing. Vidforge is a leaf — don't edit core/app files."
scope: project
load: conditional
triggers:
  [
    backlog,
    open,
    follow-up,
    todo,
    gap,
    signing,
    notarisation,
    release,
    ffmpeg,
    bundling,
    scope,
    next,
    upstream,
    leaf,
  ]
applies-to: [".github/workflows/**", "app.identity.json", ".claude/memory/**", "governance/**"]
type: project
---

# Open work

The owner's full feature set shipped in **v0.7.0** (scan → metadata/quality/thumbnail cards → internal
player → repair/convert queue with progress, bulk convert, status-bar process list, window-border signal,
de/en UI, in-app ffmpeg installer). The whole flow is proven: 81 Rust tests incl. real-ffmpeg e2e
(probe/thumbnail/convert/player), 455 frontend tests, `check:all` green each commit, and the app boots as
"Vidforge" and reaches `ready=true` on ffmpeg discovery. What remains are the **durable gaps**:

- **macOS in-app installer.** The installer covers Windows/Linux (BtbN builds + `checksums.sha256`); BtbN
  has no macOS build, so macOS shows a "install via Homebrew" message. A macOS path (evermeet/martin-riedl
  + their per-file checksum API) is a follow-up (ADR-PROJ-001 §2).
- **Player: streaming-while-transcoding.** `prepare_player` remuxes/transcodes the **whole** file before
  playback — a wait for non-web sources. A segmented/streamed transcode would remove the wait (ADR-PROJ-001 §5).
- **Custom-encode UI.** The `custom` preset (container/codec/CRF/audio) is implemented in the backend and
  exposed via `enqueue_job`; the Detail view only offers the built-in presets. A custom-encode form is the
  UI follow-up.
- **ffmpeg is detected/installed, never bundled.** Bundling would carry GPL/LGPL redistribution
  obligations and needs its own ADR + licence review (rule:dependencies, rule:privacy).
- **No code signing / notarisation** configured. The app-layer `release.yml` supports macOS signing when
  the `APPLE_*` secrets are set (ADR-APP-023); none are set here.

## Cascade position — do not re-derive it, and do not edit upstream files

```
kaoszwerg/althing            owns 'core'  (stack-agnostic)
   └── kaoszwerg/saga-rust-template   owns 'app'
          └── kaoszwerg/reenc (Vidforge)   ← this repo — LEAF, owns nothing
```

- Core files (`CLAUDE.md`, the agnostic rules/ADRs, `scripts/`) **and** app files (the Tauri/React/HUD
  rules/ADRs, `sync-*.mjs`, the CI/release workflows) are **read-only here**. Improve them in the repo that
  owns them, then `npm run governance:update`. The drift-gate refuses the in-place edit and names the three
  real options (overlay, upstream it, opt out).
- Governance for **Vidforge** goes in the project line (`.claude/rules/project/`, `docs/adr/project/`).

**Why:** these are known gaps, not oversights — recording them keeps a later agent from "fixing" them by
inventing infrastructure the owner has not asked for.

**How to apply:** pick items from here only when the owner asks; do not expand scope on your own.
