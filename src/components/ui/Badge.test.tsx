import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Dev</Badge>);
    expect(screen.getByText("Dev")).toBeInTheDocument();
  });

  it("defaults to the cyan accent", () => {
    render(<Badge>Dev</Badge>);
    const badge = screen.getByText("Dev");
    expect(badge.className).toContain("hud-accent-cyan");
    expect(badge.className).toContain("text-cyan");
  });

  it("draws the chamfered surface with the requested accent", () => {
    render(<Badge accent="gold">Poor</Badge>);
    const badge = screen.getByText("Poor");
    expect(badge.className).toContain("hud-clip-sm");
    expect(badge.className).toContain("hud-accent-gold");
    expect(badge.className).toContain("text-gold");
    expect(badge.className).toContain("bg-elevated");
  });

  it("merges a caller-provided className", () => {
    render(<Badge className="ml-2">Dev</Badge>);
    expect(screen.getByText("Dev").className).toContain("ml-2");
  });

  it("is not an interactive element", () => {
    render(<Badge>Dev</Badge>);
    expect(screen.getByText("Dev").tagName).toBe("SPAN");
  });
});
