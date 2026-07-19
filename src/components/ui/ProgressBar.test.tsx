import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("exposes the percent via the progressbar ARIA role", () => {
    render(<ProgressBar percent={42} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders the fill at the given percent width", () => {
    render(<ProgressBar percent={30} />);
    const bar = screen.getByRole("progressbar");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("30%");
  });

  it("clamps a value above 100", () => {
    render(<ProgressBar percent={137} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("100%");
  });

  it("clamps a negative value to 0", () => {
    render(<ProgressBar percent={-5} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("0%");
  });

  it("treats a non-finite value as 0", () => {
    render(<ProgressBar percent={NaN} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("defaults to the cyan accent fill", () => {
    render(<ProgressBar percent={50} />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.className).toContain("bg-cyan");
  });

  it("draws the requested accent fill", () => {
    render(<ProgressBar percent={50} accent="danger" />);
    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.className).toContain("bg-danger");
  });

  it("merges a caller-provided className onto the track", () => {
    render(<ProgressBar percent={50} className="mt-2" />);
    expect(screen.getByRole("progressbar").className).toContain("mt-2");
  });
});
