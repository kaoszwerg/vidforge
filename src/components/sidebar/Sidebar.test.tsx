import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "../../store/ui";
import { settingsDto } from "../../test/settings";

vi.mock("../../api/commands", () => ({
  api: {
    getSettings: vi.fn(),
  },
}));

import { api } from "../../api/commands";

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Sidebar />
    </QueryClientProvider>,
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    useUiStore.setState({ view: "home", aboutOpen: false });
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
  });

  it("exposes the primary navigation landmark with Library, Home, Logs and Settings", () => {
    renderSidebar();
    expect(screen.getByRole("navigation", { name: "Hauptnavigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bibliothek" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Protokolle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Einstellungen" })).toBeInTheDocument();
  });

  it("marks the active view as the current page (Library by default)", () => {
    useUiStore.setState({ view: "library", aboutOpen: false });
    renderSidebar();
    expect(screen.getByRole("button", { name: "Bibliothek" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Protokolle" })).not.toHaveAttribute("aria-current");
  });

  it("switches the active view when a nav button is clicked", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Protokolle" }));
    expect(useUiStore.getState().view).toBe("logs");
    expect(screen.getByRole("button", { name: "Protokolle" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "Einstellungen" }));
    expect(useUiStore.getState().view).toBe("settings");
    expect(screen.getByRole("button", { name: "Einstellungen" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "Bibliothek" }));
    expect(useUiStore.getState().view).toBe("library");
    expect(screen.getByRole("button", { name: "Bibliothek" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
