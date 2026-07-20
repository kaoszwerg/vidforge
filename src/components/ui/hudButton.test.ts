import { describe, it, expect } from "vitest";
import { hudButtonClass, hudAccentTextClass, hudAccentBgClass } from "./hudButton";

describe("hudButtonClass", () => {
  it("draws the chamfered solid surface by default", () => {
    const cls = hudButtonClass();
    expect(cls).toContain("hud-clip-sm");
    expect(cls).toContain("hud-btn");
    expect(cls).toContain("hud-accent-cyan");
    expect(cls).not.toContain("hud-btn-active");
  });

  it("locks a solid button into its active surface", () => {
    expect(hudButtonClass({ active: true })).toContain("hud-btn-active");
  });

  it("uses the requested accent for a solid button", () => {
    expect(hudButtonClass({ accent: "danger" })).toContain("hud-accent-danger");
  });

  it("ghost variant carries no chamfer or fill", () => {
    const cls = hudButtonClass({ variant: "ghost" });
    expect(cls).not.toContain("hud-btn");
    expect(cls).not.toContain("hud-clip-sm");
  });

  it("ghost variant defaults to a faint cyan tint at rest, brightening on hover (P2.8)", () => {
    const cls = hudButtonClass({ variant: "ghost" });
    expect(cls).toContain("text-cyan/60");
    expect(cls).toContain("hover:text-cyan");
  });

  it("ghost variant's resting/hover tint follows the requested accent", () => {
    const danger = hudButtonClass({ variant: "ghost", accent: "danger" });
    expect(danger).toContain("text-danger/60");
    expect(danger).toContain("hover:text-danger");
    expect(danger).not.toContain("text-cyan");

    const green = hudButtonClass({ variant: "ghost", accent: "green" });
    expect(green).toContain("text-green/60");
    expect(green).toContain("hover:text-green");
  });

  it("ghost variant's active state uses the full (non-muted) accent colour", () => {
    const cls = hudButtonClass({ variant: "ghost", accent: "danger", active: true });
    expect(cls).toContain("text-danger");
    // The full-strength active class is present in addition to (not instead of) the muted resting one —
    // the resting utility just loses the specificity fight once `active` is also applied.
    expect(cls.split(" ")).toContain("text-danger");
  });

  it("carries the shared disabled classes on both variants", () => {
    expect(hudButtonClass()).toContain("disabled:opacity-40");
    expect(hudButtonClass({ variant: "ghost" })).toContain("disabled:opacity-40");
  });
});

describe("hudAccentTextClass", () => {
  it("maps every accent to its text-colour class", () => {
    expect(hudAccentTextClass("cyan")).toBe("text-cyan");
    expect(hudAccentTextClass("green")).toBe("text-green");
    expect(hudAccentTextClass("gold")).toBe("text-gold");
    expect(hudAccentTextClass("purple")).toBe("text-purple");
    expect(hudAccentTextClass("danger")).toBe("text-danger");
  });
});

describe("hudAccentBgClass", () => {
  it("maps every accent to its background-colour class", () => {
    expect(hudAccentBgClass("cyan")).toBe("bg-cyan");
    expect(hudAccentBgClass("danger")).toBe("bg-danger");
  });
});
