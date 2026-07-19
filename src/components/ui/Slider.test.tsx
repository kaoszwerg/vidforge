import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Slider } from "./Slider";

describe("Slider", () => {
  it("renders a native range input with the given accessible name and value", () => {
    render(<Slider value={30} onChange={vi.fn()} ariaLabel="Volume" />);
    const input = screen.getByRole("slider", { name: "Volume" });
    expect(input).toHaveAttribute("type", "range");
    expect((input as HTMLInputElement).value).toBe("30");
  });

  it("defaults min/max/step to 0/100/1", () => {
    render(<Slider value={10} onChange={vi.fn()} ariaLabel="Seek" />);
    const input = screen.getByRole("slider", { name: "Seek" });
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "100");
    expect(input).toHaveAttribute("step", "1");
  });

  it("forwards custom min/max/step", () => {
    render(<Slider value={5} min={0} max={10} step={0.1} onChange={vi.fn()} ariaLabel="Vol" />);
    const input = screen.getByRole("slider", { name: "Vol" });
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("max", "10");
    expect(input).toHaveAttribute("step", "0.1");
  });

  it("calls onChange with the numeric value on change", () => {
    const onChange = vi.fn();
    render(<Slider value={20} onChange={onChange} ariaLabel="Seek" />);
    fireEvent.change(screen.getByRole("slider", { name: "Seek" }), { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it("clamps a value above max for rendering", () => {
    render(<Slider value={999} max={100} onChange={vi.fn()} ariaLabel="Seek" />);
    expect((screen.getByRole("slider", { name: "Seek" }) as HTMLInputElement).value).toBe("100");
  });

  it("clamps a value below min for rendering", () => {
    render(<Slider value={-5} min={0} onChange={vi.fn()} ariaLabel="Seek" />);
    expect((screen.getByRole("slider", { name: "Seek" }) as HTMLInputElement).value).toBe("0");
  });

  it("treats a non-finite value as min", () => {
    render(<Slider value={NaN} min={2} onChange={vi.fn()} ariaLabel="Seek" />);
    expect((screen.getByRole("slider", { name: "Seek" }) as HTMLInputElement).value).toBe("2");
  });

  it("is disabled when requested", () => {
    render(<Slider value={0} onChange={vi.fn()} ariaLabel="Seek" disabled />);
    expect(screen.getByRole("slider", { name: "Seek" })).toBeDisabled();
  });

  it("defaults to the cyan accent class", () => {
    render(<Slider value={0} onChange={vi.fn()} ariaLabel="Seek" />);
    expect(screen.getByRole("slider", { name: "Seek" }).className).toContain("hud-accent-cyan");
  });

  it("applies the requested accent class", () => {
    render(<Slider value={0} onChange={vi.fn()} ariaLabel="Seek" accent="danger" />);
    expect(screen.getByRole("slider", { name: "Seek" }).className).toContain("hud-accent-danger");
  });

  it("merges a caller-provided className", () => {
    render(<Slider value={0} onChange={vi.fn()} ariaLabel="Seek" className="w-20" />);
    expect(screen.getByRole("slider", { name: "Seek" }).className).toContain("w-20");
  });
});
