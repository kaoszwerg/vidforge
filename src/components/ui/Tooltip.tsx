import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { FocusEvent, MouseEvent, ReactElement, ReactNode } from "react";
import { computePopoverPlacement, type PopoverTriggerRect } from "../../lib/popoverPlacement";

interface TooltipProps {
  /** What the tooltip says. Rendered on hover and keyboard focus; nothing shows when `null`. */
  content: ReactNode;
  /** The single trigger element the tooltip describes (e.g. a `Button`/`IconButton`). */
  children: ReactElement;
}

/** Props the tooltip chains onto its trigger — existing handlers are preserved, not overwritten. */
interface TriggerProps {
  onMouseEnter?: (e: MouseEvent<Element>) => void;
  onMouseLeave?: (e: MouseEvent<Element>) => void;
  onFocus?: (e: FocusEvent<Element>) => void;
  onBlur?: (e: FocusEvent<Element>) => void;
  "aria-describedby"?: string;
}

/** First-paint placeholder size, used only for the single invisible frame before the tooltip is measured
 * (see below). The real rendered box then replaces it, so this estimate no longer has to be accurate —
 * it just has to keep the very first (hidden) paint on-screen. Width matches the popover's `max-w-[240px]`;
 * height is a conservative single-line-plus-padding guess. */
const ESTIMATED_SIZE = { width: 240, height: 32 };

/**
 * HUD tooltip (ADR-APP-026): the replacement for the native `title` attribute, whose OS-drawn bubble is a
 * visual break in the HUD. Shows a chamfered popover on hover and on keyboard focus, links it to the
 * trigger via `aria-describedby`, and dismisses on blur, pointer-leave or Escape.
 *
 * Layout-neutral: it clones the single child trigger and attaches handlers rather than wrapping it in
 * a box, so it never disturbs a flex/grid parent. The popover renders through a portal so a parent's
 * `clip-path` can't crop it, and is `pointer-events: none` so it never eats a click.
 *
 * **Two-pass placement.** `computePopoverPlacement` (shared with `Select`/`HudPanel`, P2.5) flips the
 * bubble above the trigger and clamps it against the window edges — but the clamp needs the popover's
 * real width, and the bubble isn't in the DOM when a click/hover first fires. Using the 240px *estimate*
 * for the clamp badly over-shifts a short label near an edge: a left-column sidebar button (midpoint
 * ≈30px) got clamped to `margin + 240/2 = 128px`, dropping the bubble far to the right of its button
 * (owner feedback). So the first paint uses the estimate but is kept invisible (`opacity-0`), then a
 * layout effect measures the *actual* rendered box and re-runs the placement with it — the tooltip only
 * becomes visible at its final, correctly-anchored position. Measuring in `useLayoutEffect` (not
 * `useEffect`) means the reposition happens before the browser paints, so there's no visible jump.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  // Gates visibility until the real-size measurement below has run, so the estimate-based first paint is
  // never shown — the bubble appears only once correctly placed.
  const [measured, setMeasured] = useState(false);
  // The trigger's rect is state, not a ref: it's written from an event handler that the linter's
  // data-flow treats as reachable from render (via `cloneElement`), and `react-hooks/refs` forbids a ref
  // write there. State is the correct home anyway — the measure effect below depends on it.
  const [triggerRect, setTriggerRect] = useState<PopoverTriggerRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Re-place from the tooltip's true rendered size once it's in the DOM (see the component doc comment).
  // Deps are `[open, triggerRect]` — both are set once when a tooltip opens; `measured` is deliberately
  // not a dep, so the `setPos`/`setMeasured` this performs can't re-trigger it into a loop.
  useLayoutEffect(() => {
    if (!open || !triggerRect) return;
    const el = popoverRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const placement = computePopoverPlacement(
      triggerRect,
      { width: box.width, height: box.height },
      { width: window.innerWidth, height: window.innerHeight },
      { align: "center" },
    );
    setPos(placement);
    setMeasured(true);
  }, [open, triggerRect]);

  if (!isValidElement(children)) return children;

  const show = (e: MouseEvent<Element> | FocusEvent<Element>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTriggerRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    // Best-guess placement for the single invisible frame before the layout effect measures the real box
    // and refines it. `top` is the fully-resolved absolute position for both the below and flipped-above
    // cases; `left` is the (clamped) trigger midpoint, paired with the popover's own -translate-x-1/2.
    const placement = computePopoverPlacement(
      r,
      ESTIMATED_SIZE,
      { width: window.innerWidth, height: window.innerHeight },
      { align: "center" },
    );
    setPos(placement);
    setMeasured(false);
    setOpen(true);
  };
  const hide = () => {
    setMeasured(false);
    setOpen(false);
  };

  const childProps = (children.props ?? {}) as TriggerProps;
  const trigger = cloneElement(children as ReactElement<TriggerProps>, {
    onMouseEnter: (e: MouseEvent<Element>) => {
      childProps.onMouseEnter?.(e);
      show(e);
    },
    onMouseLeave: (e: MouseEvent<Element>) => {
      childProps.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: FocusEvent<Element>) => {
      childProps.onFocus?.(e);
      show(e);
    },
    onBlur: (e: FocusEvent<Element>) => {
      childProps.onBlur?.(e);
      hide();
    },
    "aria-describedby": open ? id : childProps["aria-describedby"],
  });

  return (
    <>
      {trigger}
      {open && content != null
        ? createPortal(
            <div
              ref={popoverRef}
              role="tooltip"
              id={id}
              className={`hud-popover hud-clip-sm hud-accent-cyan text-fg pointer-events-none fixed z-[70] max-w-[240px] -translate-x-1/2 px-2 py-1 text-xs whitespace-nowrap transition-opacity duration-100 ${
                measured ? "opacity-100" : "opacity-0"
              }`}
              style={{ top: pos.top, left: pos.left }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
