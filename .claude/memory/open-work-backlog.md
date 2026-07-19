---
id: mem:open-work-backlog
title: Open follow-up work on Vidforge
tldr: "Backlog: product build is in PLAN.md; ffmpeg detected not bundled (bundling needs an ADR); no signing secrets. Vidforge is a leaf — don't edit core/app files."
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

- **The product itself is the main open work.** Folder scan, metadata cards, thumbnails, the job queue,
  and repair/convert are tracked in [`PLAN.md`](../../PLAN.md), not here. This file records only the
  durable gaps that outlive a single feature.
- **ffmpeg is detected, never bundled (yet).** Vidforge relies on a system `ffmpeg`/`ffprobe`. Bundling it
  would carry GPL/LGPL redistribution obligations and needs its own project ADR + licence review before
  anyone adds a sidecar (rule:dependencies, rule:privacy). Until then, "not found" is a first-class,
  user-visible state, not a crash.
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
