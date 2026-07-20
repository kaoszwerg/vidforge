import { describe, it, expect } from "vitest";
import { computeJobsPopoverPosition } from "./jobsPopoverPosition";

describe("computeJobsPopoverPosition", () => {
  const VIEWPORT = { width: 1200, height: 800 };

  it("offsets the popover from the trigger's bottom-right by the configured gap", () => {
    const pos = computeJobsPopoverPosition({ top: 780, right: 1190 }, VIEWPORT);
    expect(pos).toEqual({ bottom: 26, right: 10, width: 320 });
  });

  it("uses the nominal 320px width when the viewport is wide enough", () => {
    const pos = computeJobsPopoverPosition({ top: 780, right: 1190 }, VIEWPORT);
    expect(pos.width).toBe(320);
  });

  it("shrinks the width to fit a viewport narrower than 320px plus margins", () => {
    const pos = computeJobsPopoverPosition({ top: 380, right: 300 }, { width: 320, height: 400 });
    expect(pos.width).toBe(304); // 320 - 2*8
  });

  it("never lets the right offset push the popover past the left edge", () => {
    // Trigger flush with the (narrow) window's right edge — a naive `viewport.width - trigger.right`
    // offset of ~0 would be fine, but a trigger further left must not let `right` exceed
    // `viewport.width - width - margin`, or the popover would overflow past x=0.
    const pos = computeJobsPopoverPosition({ top: 100, right: 20 }, { width: 320, height: 400 });
    expect(pos.right).toBeLessThanOrEqual(320 - pos.width - 8 + 0.001);
    expect(pos.right).toBeGreaterThanOrEqual(8);
  });

  it("keeps at least an 8px margin from the right edge even when the trigger is at the edge", () => {
    const pos = computeJobsPopoverPosition({ top: 100, right: VIEWPORT.width }, VIEWPORT);
    expect(pos.right).toBeGreaterThanOrEqual(8);
  });

  it("keeps at least an 8px margin from the bottom edge when the trigger is near the top", () => {
    const pos = computeJobsPopoverPosition({ top: 2, right: 1190 }, VIEWPORT);
    expect(pos.bottom).toBeLessThanOrEqual(VIEWPORT.height - 8);
  });

  it("keeps at least an 8px margin from the bottom edge when the trigger is near the bottom", () => {
    const pos = computeJobsPopoverPosition({ top: VIEWPORT.height - 1, right: 1190 }, VIEWPORT);
    expect(pos.bottom).toBeGreaterThanOrEqual(8);
  });

  it("never returns a negative width for a pathologically tiny viewport", () => {
    const pos = computeJobsPopoverPosition({ top: 5, right: 5 }, { width: 10, height: 10 });
    expect(pos.width).toBeGreaterThanOrEqual(0);
  });
});
