import { describe, it, expect } from "vitest";
import { computePopoverPlacement } from "./popoverPlacement";

describe("computePopoverPlacement", () => {
  const VIEWPORT = { width: 1200, height: 800 };
  const POPOVER = { width: 200, height: 100 };

  it("places the popover below the trigger, offset by the default gap", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 50, right: 150 },
      POPOVER,
      VIEWPORT,
    );
    expect(pos).toEqual({ top: 126, left: 50, above: false });
  });

  it("flips above the trigger when there isn't room below but there is above", () => {
    const pos = computePopoverPlacement(
      { top: 750, bottom: 770, left: 50, right: 150 },
      POPOVER,
      VIEWPORT,
    );
    expect(pos.above).toBe(true);
    expect(pos.top).toBe(750 - 6 - 100); // trigger.top - gap - height
  });

  it("does not flip when there is enough room below", () => {
    const pos = computePopoverPlacement(
      { top: 300, bottom: 320, left: 50, right: 150 },
      POPOVER,
      VIEWPORT,
    );
    expect(pos.above).toBe(false);
  });

  it("stays below (does not flip) when above and below offer exactly equal room, since flipping gains nothing", () => {
    // A pathologically short viewport where the popover doesn't fit above or below either way — flipping
    // only helps when it gains *more* room, and a zero-height trigger dead-centre in a tiny viewport has
    // exactly equal room both ways, so the tie goes to the default (below).
    const pos = computePopoverPlacement(
      { top: 50, bottom: 50, left: 10, right: 60 },
      { width: 50, height: 200 },
      { width: 200, height: 100 },
    );
    expect(pos.above).toBe(false);
  });

  it("clamps a below-placed popover taller than the viewport to the top margin instead of running off both edges", () => {
    const pos = computePopoverPlacement(
      { top: 5, bottom: 45, left: 10, right: 60 },
      { width: 50, height: 100 },
      { width: 200, height: 50 },
    );
    expect(pos.above).toBe(false);
    expect(pos.top).toBe(8);
  });

  it("clamps the top so a flipped popover never sits closer than the margin to the top edge", () => {
    const pos = computePopoverPlacement(
      { top: 50, bottom: 780, left: 50, right: 150 }, // huge trigger, forces a flip with little room above
      POPOVER,
      VIEWPORT,
    );
    expect(pos.top).toBeGreaterThanOrEqual(8);
  });

  it("aligns the left edge to the trigger's left edge by default (Select)", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 300, right: 380 },
      POPOVER,
      VIEWPORT,
    );
    expect(pos.left).toBe(300);
  });

  it("clamps a start-aligned popover so it never overflows the right edge", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 1150, right: 1190 },
      POPOVER,
      VIEWPORT,
    );
    expect(pos.left).toBeLessThanOrEqual(VIEWPORT.width - 8 - POPOVER.width);
  });

  it("clamps a start-aligned popover so it never overflows the left edge", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: -50, right: 30 },
      POPOVER,
      VIEWPORT,
    );
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it("aligns the right edge to the trigger's right edge (HudPanel's info popover)", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 500, right: 540 },
      POPOVER,
      VIEWPORT,
      { align: "end" },
    );
    expect(pos.left).toBe(540 - 200);
  });

  it("clamps an end-aligned popover so it never overflows the left edge", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 10, right: 40 },
      POPOVER,
      VIEWPORT,
      { align: "end" },
    );
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it("centres on the trigger's horizontal midpoint (Tooltip)", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 500, right: 540 },
      POPOVER,
      VIEWPORT,
      { align: "center" },
    );
    expect(pos.left).toBe(520); // (500+540)/2
  });

  it("clamps a centre-aligned popover so it never overflows the left edge", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 0, right: 10 },
      POPOVER,
      VIEWPORT,
      { align: "center" },
    );
    expect(pos.left).toBeGreaterThanOrEqual(8 + POPOVER.width / 2);
  });

  it("clamps a centre-aligned popover so it never overflows the right edge", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 1190, right: 1200 },
      POPOVER,
      VIEWPORT,
      { align: "center" },
    );
    expect(pos.left).toBeLessThanOrEqual(VIEWPORT.width - 8 - POPOVER.width / 2);
  });

  it("uses a custom gap and margin when given", () => {
    const pos = computePopoverPlacement(
      { top: 100, bottom: 120, left: 50, right: 150 },
      POPOVER,
      VIEWPORT,
      { gap: 10, margin: 20 },
    );
    expect(pos.top).toBe(130); // 120 + 10
  });

  it("never returns a negative left for a pathologically narrow viewport", () => {
    const pos = computePopoverPlacement(
      { top: 10, bottom: 20, left: 5, right: 15 },
      { width: 500, height: 50 },
      { width: 40, height: 200 },
    );
    expect(pos.left).toBeGreaterThanOrEqual(0);
  });
});
