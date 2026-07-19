import type { SettingsDto } from "../bindings/SettingsDto";

/**
 * A complete default `SettingsDto` for tests. Override only the fields a test cares about, e.g.
 * `settingsDto({ ui_scale: 1.25 })`. Centralising the shape here keeps every settings fixture from
 * breaking each time a new field is added to the DTO (ADR-CORE-005, rule:reusability).
 */
export function settingsDto(overrides: Partial<SettingsDto> = {}): SettingsDto {
  return {
    ui_scale: 1.0,
    minimize_to_tray: false,
    language: "de",
    ffmpeg_path: null,
    ffprobe_path: null,
    output_dir: null,
    job_concurrency: 2,
    recursive_scan: true,
    ...overrides,
  };
}
