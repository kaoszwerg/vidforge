import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("renders a native checkbox input with the given accessible name", () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Select a.mp4" />);
    const box = screen.getByRole("checkbox", { name: "Select a.mp4" });
    expect(box).toHaveAttribute("type", "checkbox");
  });

  it("reflects the checked prop", () => {
    render(<Checkbox checked onChange={vi.fn()} label="Select a.mp4" />);
    expect(screen.getByRole("checkbox", { name: "Select a.mp4" })).toBeChecked();
  });

  it("reflects an unchecked state", () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Select a.mp4" />);
    expect(screen.getByRole("checkbox", { name: "Select a.mp4" })).not.toBeChecked();
  });

  it("calls onChange with the new value when toggled on", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Select a.mp4" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select a.mp4" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with the new value when toggled off", () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Select a.mp4" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select a.mp4" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("shows a check glyph only when checked", () => {
    const { container, rerender } = render(
      <Checkbox checked={false} onChange={vi.fn()} label="Select a.mp4" />,
    );
    expect(container.querySelector("svg")).toBeNull();

    rerender(<Checkbox checked onChange={vi.fn()} label="Select a.mp4" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is disabled when requested and does not report a click", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Select a.mp4" disabled />);
    const box = screen.getByRole("checkbox", { name: "Select a.mp4" });
    expect(box).toBeDisabled();
  });

  it("defaults to the green accent class", () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Select a.mp4" />);
    expect(
      screen.getByRole("checkbox", { name: "Select a.mp4" }).closest("label")?.className,
    ).toContain("hud-accent-green");
  });

  it("applies the requested accent class", () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Select a.mp4" accent="cyan" />);
    expect(
      screen.getByRole("checkbox", { name: "Select a.mp4" }).closest("label")?.className,
    ).toContain("hud-accent-cyan");
  });

  it("switches to the filled active surface once checked", () => {
    render(<Checkbox checked onChange={vi.fn()} label="Select a.mp4" />);
    expect(
      screen.getByRole("checkbox", { name: "Select a.mp4" }).closest("label")?.className,
    ).toContain("hud-btn-active");
  });

  it("merges a caller-provided className", () => {
    render(<Checkbox checked={false} onChange={vi.fn()} label="Select a.mp4" className="ml-2" />);
    expect(
      screen.getByRole("checkbox", { name: "Select a.mp4" }).closest("label")?.className,
    ).toContain("ml-2");
  });
});
