import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrityPanel } from "./IntegrityPanel";

vi.mock("../hooks/useIntegrity", () => ({ useIntegrity: vi.fn() }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn() }));

import { useIntegrity } from "../hooks/useIntegrity";
import { useSettings } from "../hooks/useSettings";

function mockIntegrity(overrides: Partial<ReturnType<typeof useIntegrity>> = {}) {
  vi.mocked(useIntegrity).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useIntegrity>);
}

describe("IntegrityPanel", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    mockIntegrity();
  });

  it("shows the quick-check pass state for a healthy file", () => {
    mockIntegrity({
      data: { path: "/v.mp4", level: "Quick", healthy: true, error_count: 0, sample_errors: [] },
    } as Partial<ReturnType<typeof useIntegrity>>);
    render(<IntegrityPanel path="/v.mp4" />);
    expect(screen.getByText("Keine Defekte (Schnellcheck)")).toBeInTheDocument();
    // Deep check is still offered.
    expect(screen.getByRole("button", { name: "Tief prüfen" })).toBeInTheDocument();
  });

  it("flags a defective file with the error count, sample and a repair hint", () => {
    mockIntegrity({
      data: {
        path: "/v.mp4",
        level: "Deep",
        healthy: false,
        error_count: 4,
        sample_errors: ["moov atom not found", "Error while decoding stream"],
      },
    } as Partial<ReturnType<typeof useIntegrity>>);
    render(<IntegrityPanel path="/v.mp4" />);
    expect(screen.getByText("4 Fehler gefunden")).toBeInTheDocument();
    expect(screen.getByText("moov atom not found")).toBeInTheDocument();
    expect(screen.getByText("Die Datei kann unten repariert werden.")).toBeInTheDocument();
    // A deep result was shown, so the deep-check button is no longer offered.
    expect(screen.queryByRole("button", { name: "Tief prüfen" })).toBeNull();
  });

  it("shows a checking state while the check is pending", () => {
    mockIntegrity({ data: undefined, isPending: true } as Partial<ReturnType<typeof useIntegrity>>);
    render(<IntegrityPanel path="/v.mp4" />);
    expect(screen.getByText("Prüfe…")).toBeInTheDocument();
  });

  it("states when the check is unavailable (e.g. ffmpeg missing) instead of crashing", () => {
    mockIntegrity({
      data: undefined,
      isError: true,
      error: new Error("ffmpeg not ready"),
    } as Partial<ReturnType<typeof useIntegrity>>);
    render(<IntegrityPanel path="/v.mp4" />);
    expect(screen.getByText("Prüfung nicht verfügbar")).toBeInTheDocument();
  });

  it("requests a deep check when the button is clicked", () => {
    mockIntegrity({
      data: { path: "/v.mp4", level: "Quick", healthy: true, error_count: 0, sample_errors: [] },
    } as Partial<ReturnType<typeof useIntegrity>>);
    render(<IntegrityPanel path="/v.mp4" />);
    fireEvent.click(screen.getByRole("button", { name: "Tief prüfen" }));
    // The deep query (useIntegrity(path, true, ...)) is now enabled — the hook was called with deep=true.
    expect(vi.mocked(useIntegrity)).toHaveBeenCalledWith("/v.mp4", true, true);
  });
});
