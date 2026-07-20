// Maps `InstallProgress.phase` (ADR-PROJ-001 §2) to its i18n label key. Split out into its own module
// (mirroring `presets.ts`'s id → key mapping) rather than living inside `FfmpegInstallProgress.tsx`:
// react-refresh/only-export-components requires a file that exports a component to export nothing else,
// and this keeps the mapping unit-testable on its own instead of only indirectly through a render.
import type { MessageKey } from "../i18n";

/** `InstallProgress.phase` (download/verify/extract/install/done) to its label key. `"error"` is
 * handled separately by the caller (the failure message replaces the progress row entirely) — a phase
 * this switch has never seen (a future backend addition) falls back to the generic "installing" label
 * rather than rendering nothing. */
export function installPhaseLabelKey(phase: string): MessageKey {
  switch (phase) {
    case "download":
      return "install.phase.download";
    case "verify":
      return "install.phase.verify";
    case "extract":
      return "install.phase.extract";
    case "done":
      return "install.phase.done";
    default:
      return "install.phase.install";
  }
}
