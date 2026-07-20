import { useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { IconButton } from "./IconButton";
import type { HudAccent } from "./hudButton";
import { computePopoverPlacement } from "../../lib/popoverPlacement";

/** The info popover isn't rendered yet when its position is computed, so its height can't be measured —
 * this is the best-guess estimate `computePopoverPlacement` flips/clamps against. Width matches the
 * popover's own fixed `w-[300px]`; height is a conservative few-lines-of-`leading-relaxed`-text guess
 * (P2.5). */
const ESTIMATED_SIZE = { width: 300, height: 120 };

interface HudPanelProps {
  accent?: HudAccent;
  label?: string;
  /** Optional documentation shown via an "i" button (what it shows, how it's computed/interpreted). */
  info?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** An "i" button that opens a small doc popover. Rendered via a portal so the panel's clip-path /
 * overflow can't clip it; closes on outside-click or Escape. The trigger is the shared `IconButton`
 * HUD primitive (ADR-APP-026) — no raw button, no native tooltip. */
function InfoButton({ info }: { info: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    if (!open) {
      const r = e.currentTarget.getBoundingClientRect();
      // Right-aligned to the trigger ("end"): mirrors the previous `r.right - 300` anchor, now also
      // flipping above and clamping via the shared util so a panel near the bottom of the window
      // doesn't run the popover off-screen (P2.5).
      setPos(
        computePopoverPlacement(
          r,
          ESTIMATED_SIZE,
          { width: window.innerWidth, height: window.innerHeight },
          { align: "end" },
        ),
      );
    }
    setOpen((o) => !o);
  };
  return (
    <>
      <IconButton
        label="What is this?"
        variant="ghost"
        tooltip={null}
        onClick={toggle}
        className="shrink-0"
      >
        <Info size={14} strokeWidth={2} />
      </IconButton>
      {open
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setOpen(false)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                role="presentation"
              />
              <div
                className="hud-clip-sm bg-elevated text-dim fixed z-[61] w-[300px] p-3 text-xs leading-relaxed shadow-lg"
                style={{
                  top: pos.top,
                  left: pos.left,
                  boxShadow: "0 0 0 1px rgb(var(--saga-neon-cyan-rgb) / 0.3)",
                }}
              >
                {info}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Chamfered HUD panel (saga design, ADR-APP-020). The neon border + inner glow come from the `.hud-panel`
 * / `.hud-clip` CSS; content sits above the pseudo-element layers. An optional `info` doc popover is
 * surfaced via an "i" button in the header.
 */
export function HudPanel({
  accent = "cyan",
  label,
  info,
  className = "",
  children,
}: HudPanelProps) {
  return (
    <div className={`hud-panel hud-clip hud-accent-${accent} ${className}`}>
      <div className="relative z-[1] p-4">
        {label || info ? (
          <div className="mb-3 flex items-start justify-between gap-2">
            {label ? <div className="hud-label">{label}</div> : <span />}
            {info ? <InfoButton info={info} /> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
