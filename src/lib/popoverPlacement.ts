// Pure placement math shared by every portal-rendered popover anchored to a trigger element (P2.5,
// design-review): `Select`'s listbox, `HudPanel`'s info popover and `Tooltip`'s bubble each used to
// compute their own `top`/`left` ad hoc, always anchoring *below* the trigger with no flip — near the
// bottom of the window the popover ran past the viewport edge and got clipped by the frameless window's
// own overflow. Centralised here (ADR-CORE-005) so all three flip above the trigger when there isn't
// room below, and clamp horizontally so they never run past the left/right edge either.
//
// Takes plain records rather than a live `DOMRect`/`Window`, mirroring `jobsPopoverPosition.ts`, so the
// placement math is trivially unit-testable without a DOM and so a caller only reads a
// `getBoundingClientRect()` once, before the portal exists (none of the three callers can measure the
// popover's own rendered size — it isn't in the DOM yet when the position is computed — so `popover`
// is the caller's best size *estimate*, the same imprecision the original ad hoc code already carried;
// this module only makes the flip/clamp behaviour itself correct and shared, not the size prediction).

/** The trigger element's own rect, in viewport coordinates (`Element.getBoundingClientRect()`). */
export interface PopoverTriggerRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The popover's size — the caller's best estimate, since the popover isn't rendered yet when this runs
 * (see the module doc comment). */
export interface PopoverSize {
  width: number;
  height: number;
}

export interface PopoverViewport {
  width: number;
  height: number;
}

export interface PopoverPlacement {
  /** `fixed`-position `top`, in viewport pixels. */
  top: number;
  /** `fixed`-position `left`, in viewport pixels. For `align: "center"` this is the trigger's horizontal
   * midpoint (clamped) — the caller is expected to also apply `-translate-x-1/2`, matching `Tooltip`'s
   * existing centring approach. */
  left: number;
  /** `true` when the popover was flipped above the trigger instead of the default below. */
  above: boolean;
}

export interface PopoverPlacementOptions {
  /** Gap kept between the trigger and the popover along the flip axis. Default 6 — matches the gap
   * every one of the three original call sites already used. */
  gap?: number;
  /** Minimum clearance kept from every viewport edge. Default 8 — matches `jobsPopoverPosition`'s
   * margin. */
  margin?: number;
  /** Horizontal anchor. `"start"` (default) aligns the popover's left edge with the trigger's left edge
   * (`Select`'s listbox). `"end"` aligns the popover's right edge with the trigger's right edge
   * (`HudPanel`'s info popover). `"center"` centers it on the trigger's horizontal midpoint, for a
   * caller applying `-translate-x-1/2` (`Tooltip`). */
  align?: "start" | "end" | "center";
}

const DEFAULT_GAP = 6;
const DEFAULT_MARGIN = 8;

/** Clamps `value` into `[min, max]`, tolerating a degenerate `max < min` (a popover wider/taller than
 * the viewport minus margins) by falling back to `min` rather than returning a value past it — the same
 * defensive shape `jobsPopoverPosition.ts` uses for its own clamps. */
function clampRange(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Placement for a `fixed`-positioned popover anchored to `trigger`: below by default, flipped above when
 * there isn't room below *and* flipping actually gains room, and always clamped so it never sits closer
 * than `margin` to a viewport edge — regardless of window size (P2.5).
 */
export function computePopoverPlacement(
  trigger: PopoverTriggerRect,
  popover: PopoverSize,
  viewport: PopoverViewport,
  options: PopoverPlacementOptions = {},
): PopoverPlacement {
  const gap = options.gap ?? DEFAULT_GAP;
  const margin = options.margin ?? DEFAULT_MARGIN;
  const align = options.align ?? "start";

  const roomBelow = viewport.height - trigger.bottom;
  const roomAbove = trigger.top;
  const fitsBelow = roomBelow >= popover.height + gap + margin;
  // Flip only when below genuinely doesn't fit AND above offers more room — otherwise a trigger sitting
  // near the vertical middle would flip for no benefit.
  const above = !fitsBelow && roomAbove > roomBelow;

  const maxTopBelow = Math.max(margin, viewport.height - popover.height - margin);
  const top = above
    ? Math.max(margin, trigger.top - gap - popover.height)
    : clampRange(trigger.bottom + gap, margin, maxTopBelow);

  const maxLeftStart = Math.max(margin, viewport.width - popover.width - margin);
  let left: number;
  if (align === "center") {
    const center = (trigger.left + trigger.right) / 2;
    const minCenter = margin + popover.width / 2;
    const maxCenter = Math.max(minCenter, viewport.width - margin - popover.width / 2);
    left = clampRange(center, minCenter, maxCenter);
  } else if (align === "end") {
    left = clampRange(trigger.right - popover.width, margin, maxLeftStart);
  } else {
    left = clampRange(trigger.left, margin, maxLeftStart);
  }

  return { top, left, above };
}
