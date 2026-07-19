import type { CSSProperties } from "react";
import type { HudAccent } from "./hudButton";

export interface SliderProps {
  /** Current value. A finite value outside `[min, max]` is clamped for rendering — the caller may pass
   * a value that is briefly out of range (e.g. `currentTime` racing a not-yet-loaded `duration`) without
   * pre-validating it, mirroring `ProgressBar`'s stance on `percent`. */
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** HUD accent colour (ADR-APP-020) for the thumb and the filled portion of the track. Defaults to cyan. */
  accent?: HudAccent;
  /** Accessible name — a range slider carries no visible text of its own. */
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * HUD range slider (ADR-APP-026): the primitive `<input type="range">` is built into — a raw one is
 * banned everywhere else. Reuses the WebKit/Gecko pseudo-element skin already declared in
 * `globals.css` (`input[type="range"]`), and sets the `--slider-fill` custom property that skin reads to
 * a two-stop gradient, so the portion up to `value` renders in the requested HUD accent
 * (`var(--hud-accent)`, applied via the shared `hud-accent-*` utility) and the remainder shows the
 * elevated-surface track colour.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  accent = "cyan",
  ariaLabel,
  disabled = false,
  className = "",
}: SliderProps) {
  const clamped = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const range = max - min;
  const percent = range > 0 ? ((clamped - min) / range) * 100 : 0;
  const fill = `linear-gradient(to right, var(--hud-accent, var(--saga-neon-green)) ${percent}%, rgb(var(--saga-bg-elevated-rgb)) ${percent}%)`;

  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={clamped}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`hud-accent-${accent} w-full disabled:cursor-not-allowed disabled:opacity-40 ${className}`.trim()}
      style={{ "--slider-fill": fill } as CSSProperties}
    />
  );
}
