import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogsView } from "./LogsView";
import { settingsDto } from "../test/settings";
import type { LogRecord } from "../bindings/LogRecord";

const clear = vi.fn();
const setPaused = vi.fn();

vi.mock("../hooks/useLogs", () => ({
  useLogs: vi.fn(),
}));

vi.mock("../api/commands", () => ({
  api: {
    getSettings: vi.fn(),
  },
}));

import { useLogs } from "../hooks/useLogs";
import { api } from "../api/commands";

function rec(overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    ts: "2026-07-11T10:00:00Z",
    level: "INFO",
    target: "app::boot",
    message: "hello",
    fields: "{}",
    ...overrides,
  };
}

function mockLogsState(overrides: Partial<ReturnType<typeof useLogs>> = {}) {
  vi.mocked(useLogs).mockReturnValue({
    logs: [],
    isLoading: false,
    error: null,
    clear,
    paused: false,
    setPaused,
    ...overrides,
  });
}

function renderLogs() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LogsView />
    </QueryClientProvider>,
  );
}

describe("LogsView", () => {
  beforeEach(() => {
    clear.mockReset();
    setPaused.mockReset();
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
  });

  it("shows a loading state while the initial snapshot is pending", () => {
    mockLogsState({ isLoading: true, logs: [] });
    renderLogs();
    expect(screen.getByText("Lädt…")).toBeInTheDocument();
  });

  it("shows an empty state when there are no records", () => {
    mockLogsState();
    renderLogs();
    expect(screen.getByText("Keine Protokolleinträge.")).toBeInTheDocument();
  });

  it("shows an error state when the snapshot query fails", () => {
    mockLogsState({ error: new Error("boom") });
    renderLogs();
    expect(screen.getByText(/Fehler beim Laden der Protokolle: boom/)).toBeInTheDocument();
  });

  it("filters rows by level", () => {
    mockLogsState({
      logs: [
        rec({ message: "info line", level: "INFO" }),
        rec({ message: "error line", level: "ERROR" }),
      ],
    });
    renderLogs();
    expect(screen.getByText("info line")).toBeInTheDocument();
    expect(screen.getByText("error line")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ERROR" }));
    expect(screen.queryByText("info line")).toBeNull();
    expect(screen.getByText("error line")).toBeInTheDocument();
  });

  it("filters rows by the search box across message and target", () => {
    mockLogsState({
      logs: [
        rec({ message: "boot complete", target: "app::boot" }),
        rec({ message: "settings saved", target: "app::settings" }),
      ],
    });
    renderLogs();

    fireEvent.change(screen.getByPlaceholderText("suchen…"), {
      target: { value: "settings" },
    });
    expect(screen.queryByText("boot complete")).toBeNull();
    expect(screen.getByText("settings saved")).toBeInTheDocument();
  });

  it("toggles pause and triggers clear", () => {
    mockLogsState({ logs: [rec()] });
    renderLogs();

    fireEvent.click(screen.getByRole("button", { name: "live" }));
    expect(setPaused).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "leeren" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("shows the paused state as its own button label", () => {
    mockLogsState({ logs: [rec()], paused: true });
    renderLogs();
    expect(screen.getByRole("button", { name: "pausiert" })).toBeInTheDocument();
  });
});
