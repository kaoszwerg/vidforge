import { hudAccentBgClass, type HudAccent } from "./hudButton";

export interface ProgressBarProps {
  /** Progress 0..100. Ignored while `indeterminate` is set. A value outside 0..100 (or non-finite) is
   * clamped — the caller may pass a `JobDto.percent`/`InstallProgress.percent` straight through without
   * pre-validating backend data. */
  percent: number;
  /** Renders a full-width pulsing fill instead of a percent-width bar, and omits `aria-valuenow`
   * (WAI-ARIA: an indeterminate progressbar carries no numeric value) — for a phase the backend cannot
   * yet report a percentage for (e.g. `InstallProgress.percent === -1` during extraction). */
  indeterminate?: boolean;
  /** HUD accent colour (ADR-APP-020). Defaults to cyan. */
  accent?: HudAccent;
  className?: string;
}

/**
 * HUD progress bar (ADR-APP-020): a chamfered track with a solid accent-coloured fill, used by the
 * status-bar job list to show a running job's `percent` and the ffmpeg installer to show its download
 * progress. Not a native `<progress>` element — it carries its own chamfer/glow like every other HUD
 * surface — but exposes the same `progressbar` ARIA role so assistive tech reads it the same way.
 */
export function ProgressBar({
  percent,
  indeterminate = false,
  accent = "cyan",
  className = "",
}: ProgressBarProps) {
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`hud-clip-sm bg-elevated relative h-1.5 w-full overflow-hidden ${className}`.trim()}
    >
      <div
        className={`h-full ${hudAccentBgClass(accent)} ${
          indeterminate ? "w-full animate-pulse" : "transition-[width] duration-300 ease-out"
        }`}
        style={indeterminate ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}
