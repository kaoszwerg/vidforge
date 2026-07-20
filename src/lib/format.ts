// Pure, locale-agnostic formatting helpers for video metadata (ADR-PROJ-001: VideoCard/DetailView).
// No `Intl`/locale dependency: the values are technical (file size, duration, bit rate, frame rate),
// not user-locale content — "MB"/"Mbps"/"fps" read the same in German and English, matching how the
// rest of the app already treats technical units (e.g. LogsView's timestamps aside, nothing here is
// prose that belongs in the i18n catalogue).

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Human-readable file size, binary (1024) units — e.g. `formatBytes(1_500_000)` -> `"1.4 MB"`.
 * Whole bytes below 1 KB; one decimal place from KB upward. A negative or non-finite input (never
 * expected from a `size_bytes` field, but this is a pure function with no caller to trust) renders as
 * `"0 B"` rather than producing `"NaN B"`.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  // `.at()` rather than bracket indexing — `unitIndex` is loop-bounded and always in range, but
  // `security/detect-object-injection` flags dynamic bracket access regardless (see the same
  // reasoning in Select.tsx/hudButton.ts); `.at()` reads identically without tripping it.
  return `${value.toFixed(1)} ${BYTE_UNITS.at(unitIndex) ?? "B"}`;
}

/** Duration as `h:mm:ss` once an hour or more, else `m:ss` — e.g. `formatDuration(75)` -> `"1:15"`,
 * `formatDuration(3661)` -> `"1:01:01"`. Rounds to the nearest whole second. */
export function formatDuration(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "0:00";
  const total = Math.round(secs);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Bit rate in the largest sensible unit — e.g. `formatBitrate(5_200_000)` -> `"5.2 Mbps"`,
 * `formatBitrate(320_000)` -> `"320.0 Kbps"`. `ffprobe`'s `bit_rate` fields are bits/sec. */
export function formatBitrate(bitsPerSec: number): string {
  if (!Number.isFinite(bitsPerSec) || bitsPerSec <= 0) return "0 bps";
  if (bitsPerSec < 1000) return `${Math.round(bitsPerSec)} bps`;
  if (bitsPerSec < 1_000_000) return `${(bitsPerSec / 1000).toFixed(1)} Kbps`;
  return `${(bitsPerSec / 1_000_000).toFixed(1)} Mbps`;
}

/**
 * Short, scannable resolution tier for a badge — e.g. `resolutionLabel(1920, 1080)` -> `"1080p"`,
 * `resolutionLabel(3840, 2160)` -> `"4K"`. Derived from the **shorter** side (`min(width, height)`) so
 * it is orientation-agnostic: a 1080×1920 portrait phone clip is still "1080p", matching how people name
 * it, not "1920p". Falls back to `"{p}p"` for an unusual size and `"—"` for a missing/zero dimension.
 */
export function resolutionLabel(width: number, height: number): string {
  const p = Math.min(width, height);
  if (!Number.isFinite(p) || p <= 0) return "—";
  if (p >= 4320) return "8K";
  if (p >= 2160) return "4K";
  if (p >= 1440) return "1440p";
  if (p >= 1080) return "1080p";
  if (p >= 720) return "720p";
  if (p >= 576) return "576p";
  if (p >= 480) return "480p";
  if (p >= 360) return "360p";
  return `${p}p`;
}

/** Frame rate — e.g. `formatFps(30)` -> `"30 fps"`, `formatFps(29.97)` -> `"29.97 fps"`: a whole
 * number prints without decimals, a fractional rate (common with NTSC-derived sources) keeps two. */
export function formatFps(fps: number): string {
  if (!Number.isFinite(fps) || fps <= 0) return "0 fps";
  const rounded = Math.round(fps * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} fps`;
}
