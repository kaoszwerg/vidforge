// Localizes a `PresetDto.id` (ADR-PROJ-001 §4). The backend's `jobs::preset::all_presets()` carries no
// display text on purpose ("Labels are localized frontend-side" — src-tauri/src/commands/jobs.rs) — this
// is the one place that mapping lives, so DetailView's preset picker and the status-bar job list agree on
// what "universal" is called (ADR-CORE-005, rule:reusability). A `switch` over the five known ids (not a
// lookup table) so an id the backend adds without a matching case here still returns a sane fallback
// instead of a runtime "no such key" — `id` arrives as a plain `string` off the wire, not a closed union.
import type { MessageKey } from "../i18n";

/** Localized label key for a preset id (`preset.universal` … `preset.custom`). Falls back to the
 * `custom` label for an id this frontend does not (yet) recognise. */
export function presetLabelKey(id: string): MessageKey {
  switch (id) {
    case "universal":
      return "preset.universal";
    case "efficient":
      return "preset.efficient";
    case "archive":
      return "preset.archive";
    case "repair":
      return "preset.repair";
    case "custom":
      return "preset.custom";
    default:
      return "preset.custom";
  }
}

/** Localized short-description key for a preset id, shown under the picker once a preset is selected. */
export function presetDescriptionKey(id: string): MessageKey {
  switch (id) {
    case "universal":
      return "preset.universal.desc";
    case "efficient":
      return "preset.efficient.desc";
    case "archive":
      return "preset.archive.desc";
    case "repair":
      return "preset.repair.desc";
    case "custom":
      return "preset.custom.desc";
    default:
      return "preset.custom.desc";
  }
}

/**
 * Whether a preset id belongs in a Convert picker (DetailView's Actions panel, LibraryView's bulk
 * action bar — one rule, shared, ADR-CORE-005). Excludes `"repair"`, which has its own dedicated button
 * that always calls `enqueueJob(path, "repair")` regardless of the picker, and `"custom"`, for which no
 * custom-encode form exists in the UI yet — offering it would let a click enqueue a job the backend
 * rejects for missing `CustomEncode` fields (`src-tauri/src/jobs/preset.rs`).
 */
export function isConvertiblePreset(id: string): boolean {
  return id !== "repair" && id !== "custom";
}
