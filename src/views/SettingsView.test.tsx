import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettingsView } from "./SettingsView";

const mutate = vi.fn();

vi.mock("../hooks/useSettings", () => ({
  useSettings: vi.fn(),
  useUpdateSettings: vi.fn(),
}));

import { useSettings, useUpdateSettings } from "../hooks/useSettings";

function mockSettings(
  overrides: { ui_scale?: number; minimize_to_tray?: boolean; language?: string } = {},
) {
  vi.mocked(useSettings).mockReturnValue({
    data: { ui_scale: 1, minimize_to_tray: false, language: "de", ...overrides },
  } as unknown as ReturnType<typeof useSettings>);
  vi.mocked(useUpdateSettings).mockReturnValue({
    mutate,
  } as unknown as ReturnType<typeof useUpdateSettings>);
}

describe("SettingsView", () => {
  beforeEach(() => {
    mutate.mockReset();
  });

  it("calls updateSettings with the chosen UI scale", () => {
    mockSettings();
    render(<SettingsView />);

    fireEvent.click(screen.getByRole("button", { name: "125%" }));
    expect(mutate).toHaveBeenCalledWith({ uiScale: 1.25 });
  });

  it("renders a scale button for the persisted value", () => {
    mockSettings({ ui_scale: 0.8 });
    render(<SettingsView />);
    expect(screen.getByRole("button", { name: "80%" })).toBeInTheDocument();
  });

  it("marks App beenden as pressed when minimizeToTray is false", () => {
    mockSettings({ minimize_to_tray: false });
    render(<SettingsView />);
    expect(screen.getByRole("button", { name: "App beenden" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "In den Tray minimieren" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks In den Tray minimieren as pressed when minimizeToTray is true", () => {
    mockSettings({ minimize_to_tray: true });
    render(<SettingsView />);
    expect(screen.getByRole("button", { name: "In den Tray minimieren" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "App beenden" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles minimizeToTray via the close-button preference", () => {
    mockSettings();
    render(<SettingsView />);

    fireEvent.click(screen.getByRole("button", { name: "In den Tray minimieren" }));
    expect(mutate).toHaveBeenCalledWith({ minimizeToTray: true });

    fireEvent.click(screen.getByRole("button", { name: "App beenden" }));
    expect(mutate).toHaveBeenCalledWith({ minimizeToTray: false });
  });

  it("falls back to defaults (100%, App beenden, Deutsch) while settings have not loaded", () => {
    vi.mocked(useSettings).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useSettings>);
    vi.mocked(useUpdateSettings).mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useUpdateSettings>);
    render(<SettingsView />);

    expect(screen.getByRole("button", { name: "100%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "App beenden" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Sprache" })).toHaveTextContent("Deutsch");
  });

  it("shows the persisted language as the selected option (and switches the whole UI to it)", () => {
    mockSettings({ language: "en" });
    render(<SettingsView />);
    // The persisted language drives the entire view's translator, not just the Select's value — so
    // once it is "en" the Select's own accessible name switches too ("Language", not "Sprache").
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English");
  });

  it("switches the language via the Select and calls updateSettings", () => {
    mockSettings({ language: "de" });
    render(<SettingsView />);

    fireEvent.click(screen.getByRole("combobox", { name: "Sprache" }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));

    expect(mutate).toHaveBeenCalledWith({ language: "en" });
  });
});
