import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dialog } from "./Dialog";

vi.mock("../../hooks/useSettings", () => ({ useSettings: vi.fn() }));
import { useSettings } from "../../hooks/useSettings";

describe("Dialog", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
  });

  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={vi.fn()} heading="Ordner wählen">
        <p>body-content</p>
      </Dialog>,
    );
    expect(screen.queryByText("body-content")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the heading and body in a modal dialog when open", () => {
    render(
      <Dialog open onClose={vi.fn()} heading="Ordner wählen">
        <p>body-content</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Ordner wählen")).toBeInTheDocument();
    expect(screen.getByText("body-content")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} heading="X">
        <p>b</p>
      </Dialog>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when a close affordance (header button / scrim) is clicked", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} heading="X">
        <p>b</p>
      </Dialog>,
    );
    // Both the header close button and the scrim are labelled "Schließen"; either dismisses the dialog.
    const closers = screen.getAllByRole("button", { name: "Schließen" });
    expect(closers.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closers[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders a footer when provided", () => {
    render(
      <Dialog open onClose={vi.fn()} heading="X" footer={<span>footer-here</span>}>
        <p>b</p>
      </Dialog>,
    );
    expect(screen.getByText("footer-here")).toBeInTheDocument();
  });
});
