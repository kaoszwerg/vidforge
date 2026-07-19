import type { ReactNode } from "react";
import { hudAccentTextClass, type HudAccent } from "./hudButton";

export interface BadgeProps {
  /** HUD accent colour (ADR-APP-020). Defaults to cyan. */
  accent?: HudAccent;
  className?: string;
  children: ReactNode;
}

/**
 * Small chamfered HUD pill for a short status label (ADR-APP-020, ADR-APP-026) — the "Dev" badge in
 * `TitleBar` generalised into a reusable primitive, e.g. `QualityBadge`. A badge is a label, not a
 * control: it is not focusable and carries no interaction; wrap it in a `Tooltip` if it needs an
 * accessible explanation beyond its own text.
 */
export function Badge({ accent = "cyan", className = "", children }: BadgeProps) {
  return (
    <span
      className={`hud-clip-sm hud-accent-${accent} bg-elevated ${hudAccentTextClass(accent)} px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ${className}`.trim()}
    >
      {children}
    </span>
  );
}
