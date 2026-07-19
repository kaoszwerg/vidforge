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
});
