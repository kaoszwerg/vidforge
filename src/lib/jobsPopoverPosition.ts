// Pure placement math for the status-bar job-queue popover (`JobsIndicator`, ADR-PROJ-001 §4). Kept out
// of the component file so it stays unit-testable without a DOM and so the component file exports only
// the component (react-refresh/only-export-components — a non-component runtime export there breaks Fast
// Refresh for the whole file).

/** Nominal popover width (20rem) before viewport clamping. */
export const POPOVER_WIDTH = 320;
/** Minimum clearance the popover keeps from every viewport edge — the window's own chamfered corners
 * (`--hud-window-clip`, globals.css) clip anything closer than ~20px to the bottom-right corner, and a
 * narrow window can be smaller than `POPOVER_WIDTH` outright. Not exported — only `computeJobsPopoverPosition`
 * (below, in this module) needs it; a caller that wants the effective margin can read it off the
 * returned `JobsPopoverPosition` instead. */
const POPOVER_MARGIN = 8;
/** Gap between the trigger button and the popover's top edge. */
const POPOVER_GAP = 6;

export interface JobsPopoverPosition {
  bottom: number;
  right: number;
  width: number;
}

/**
 * Placement for a `fixed`-positioned popover anchored to a trigger's bottom-right, clamped so it never
 * sits closer than `POPOVER_MARGIN` to any viewport edge and never exceeds the viewport — regardless of
 * window size. Takes plain `{ top, right }`/`{ width, height }` records rather than a live
 * `DOMRect`/`Window` so it is trivial to unit-test without a DOM.
 */
export function computeJobsPopoverPosition(
  trigger: { top: number; right: number },
  viewport: { width: number; height: number },
): JobsPopoverPosition {
  const width = Math.max(0, Math.min(POPOVER_WIDTH, viewport.width - POPOVER_MARGIN * 2));
  const maxRight = Math.max(POPOVER_MARGIN, viewport.width - width - POPOVER_MARGIN);
  const right = Math.min(maxRight, Math.max(POPOVER_MARGIN, viewport.width - trigger.right));
  const bottom = Math.min(
    Math.max(POPOVER_MARGIN, viewport.height - trigger.top + POPOVER_GAP),
    Math.max(POPOVER_MARGIN, viewport.height - POPOVER_MARGIN),
  );
  return { bottom, right, width };
}
