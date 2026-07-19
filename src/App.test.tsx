import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import { APP_NAME } from "./lib/app";

vi.mock("./api/commands", () => ({
  api: {
    appVersion: vi.fn().mockResolvedValue("0.1.0"),
    buildInfo: vi.fn().mockResolvedValue({
      version: "0.1.0",
      channel: "dev",
      debug: true,
      git_sha: "abc1234",
      git_dirty: false,
      commit_date: "2026-07-11T00:00:00Z",
    }),
    getSettings: vi.fn().mockResolvedValue({ ui_scale: 1 }),
    updateSettings: vi.fn(),
    getRecentLogs: vi.fn().mockResolvedValue([]),
    openExternal: vi.fn(),
    // LibraryView (the default view, ADR-PROJ-001) checks ffmpeg availability before rendering
    // anything else — resolved "ready" so the shell-smoke test exercises the normal Dropzone path
    // rather than the ffmpeg-missing notice.
    discoverFfmpeg: vi.fn().mockResolvedValue({
      ffmpeg: { path: "/usr/bin/ffmpeg", version: "6.1.1", source: "path" },
      ffprobe: { path: "/usr/bin/ffprobe", version: "6.1.1", source: "path" },
      ready: true,
    }),
    scanFolder: vi.fn().mockResolvedValue([]),
    probeMedia: vi.fn(),
    getThumbnail: vi.fn(),
    pickFolder: vi.fn().mockResolvedValue(null),
    // useJobs (App shell: window-frame activity signal + status-bar JobsIndicator) always mounts.
    listJobs: vi.fn().mockResolvedValue([]),
    listPresets: vi.fn().mockResolvedValue([]),
    enqueueJob: vi.fn(),
    cancelJob: vi.fn(),
  },
}));

// The TitleBar imports an SVG that the build pipeline normally provides; in jsdom we stub it.
vi.mock("../src-tauri/icons/icon.svg", () => ({ default: "icon.svg" }));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    label: "main",
  }),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    setZoom: vi.fn().mockResolvedValue(undefined),
    // LibraryView's Dropzone (the default view) subscribes to this on mount.
    onDragDropEvent: vi.fn().mockResolvedValue(() => undefined),
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

import { api } from "./api/commands";

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App shell", () => {
  it("renders the HUD title bar with the app name", async () => {
    renderApp();
    expect(await screen.findAllByText(APP_NAME, { exact: false })).toBeTruthy();
  });

  it("shows the primary navigation rail", () => {
    renderApp();
    expect(screen.getByLabelText("Hauptnavigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Bibliothek")).toBeInTheDocument();
    expect(screen.getByLabelText("Start")).toBeInTheDocument();
    expect(screen.getByLabelText("Protokolle")).toBeInTheDocument();
    expect(screen.getByLabelText("Einstellungen")).toBeInTheDocument();
  });

  it("opens on the Library view by default (ADR-PROJ-001)", async () => {
    renderApp();
    expect(screen.getByLabelText("Bibliothek")).toHaveAttribute("aria-current", "page");
    expect(await screen.findByText("Ordner hierher ziehen oder durchsuchen")).toBeInTheDocument();
  });

  it("does not energize the window frame when the job queue is empty", async () => {
    const { container } = renderApp();
    await screen.findAllByText(APP_NAME, { exact: false });
    expect(container.querySelector(".window-frame")).not.toHaveClass("is-active");
  });

  it("energizes the window frame while a job is running", async () => {
    vi.mocked(api.listJobs).mockResolvedValue([
      {
        id: "job-1",
        input_path: "/videos/a.mp4",
        input_name: "a.mp4",
        output_path: "/out/a.mp4",
        preset_id: "universal",
        state: "Running",
        percent: 10,
        error: null,
      },
    ]);
    const { container } = renderApp();
    await waitFor(() => expect(container.querySelector(".window-frame")).toHaveClass("is-active"));
  });
});
