import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MetaRow } from "./MetaRow";

describe("MetaRow", () => {
  it("renders the label and value", () => {
    render(
      <dl>
        <MetaRow k="version" v="v0.3.0" />
      </dl>,
    );
    expect(screen.getByText("version")).toBeInTheDocument();
    expect(screen.getByText("v0.3.0")).toBeInTheDocument();
  });

  it("renders the label as a dt and the value as a dd", () => {
    render(
      <dl>
        <MetaRow k="codec" v="H264" />
      </dl>,
    );
    expect(screen.getByText("codec").tagName).toBe("DT");
    expect(screen.getByText("H264").tagName).toBe("DD");
  });

  it("lays the label and value out as an associated pair, not a justified row", () => {
    render(
      <dl>
        <MetaRow k="codec" v="H264" />
      </dl>,
    );
    const row = screen.getByText("codec").parentElement;
    expect(row?.className).toContain("grid-cols-[minmax(0,auto)_1fr]");
    expect(row?.className).not.toContain("justify-between");
  });

  it("dims the label and truncates a long value instead of stretching the row", () => {
    render(
      <dl>
        <MetaRow k="container" v="A very long container description that should not wrap" />
      </dl>,
    );
    expect(screen.getByText("container").className).toContain("text-dim");
    const value = screen.getByText("A very long container description that should not wrap");
    expect(value.className).toContain("text-fg");
    expect(value.className).toContain("truncate");
  });
});
