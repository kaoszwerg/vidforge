import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeView } from "./HomeView";
import { APP_NAME, APP_TAGLINE } from "../lib/app";
import type { JobDto } from "../bindings/JobDto";

vi.mock("../hooks/useFfmpegStatus", () => ({ useFfmpegStatus: vi.fn() }));
vi.mock("../hooks/useInstallFfmpeg", () => ({ useInstallFfmpeg: vi.fn() }));
vi.mock("../hooks/useJobs", () => ({ useJobs: vi.fn(), usePresets: vi.fn() }));
vi.mock("../hooks/useBuildInfo", () => ({ useBuildInfo: vi.fn() }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn() }));
vi.mock("../store/library", () => ({ useLibraryStore: vi.fn() }));
vi.mock("../store/ui", () => ({ useUiStore: vi.fn() }));
// Stub the folder browser to a single button that fires `onChoose` — this test verifies the wiring
// (open → choose → setFolder/setView), not the browser's own tree/content (that has its own tests).
vi.mock("../components/FolderBrowser", () => ({
  FolderBrowser: ({ open, onChoose }: { open: boolean; onChoose: (p: string) => void }) =>
    open ? <button onClick={() => onChoose("/picked")}>choose-folder-stub</button> : null,
}));

import { useFfmpegStatus } from "../hooks/useFfmpegStatus";
import { useInstallFfmpeg } from "../hooks/useInstallFfmpeg";
import { useJobs, usePresets } from "../hooks/useJobs";
import { useBuildInfo } from "../hooks/useBuildInfo";
import { useSettings } from "../hooks/useSettings";
import { useLibraryStore } from "../store/library";
import { useUiStore } from "../store/ui";

const readyStatus = {
  ffmpeg: { path: "/usr/bin/ffmpeg", version: "6.1.1", source: "path" },
  ffprobe: { path: "/usr/bin/ffprobe", version: "6.1.1", source: "path" },
  ready: true,
};

function mockFfmpeg(overrides: Partial<ReturnType<typeof useFfmpegStatus>> = {}) {
  vi.mocked(useFfmpegStatus).mockReturnValue({
    data: readyStatus,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useFfmpegStatus>);
}

const installMutate = vi.fn();
function mockInstall(overrides: Partial<ReturnType<typeof useInstallFfmpeg>> = {}) {
  vi.mocked(useInstallFfmpeg).mockReturnValue({
    install: installMutate,
    progress: null,
    isInstalling: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useInstallFfmpeg>);
}

function mockJobs(overrides: Partial<ReturnType<typeof useJobs>> = {}) {
  vi.mocked(useJobs).mockReturnValue({
    jobs: [],
    isLoading: false,
    error: null,
    running: 0,
    queued: 0,
    active: false,
    ...overrides,
  } as ReturnType<typeof useJobs>);
}

const PRESETS = [
  { id: "universal", container: "mp4", reencodes: true },
  { id: "repair", container: "mp4", reencodes: false },
];

function mockPresets(overrides: Partial<ReturnType<typeof usePresets>> = {}) {
  vi.mocked(usePresets).mockReturnValue({
    data: PRESETS,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof usePresets>);
}

function mockBuildInfo(overrides: Partial<ReturnType<typeof useBuildInfo>> = {}) {
  vi.mocked(useBuildInfo).mockReturnValue({
    data: {
      version: "0.2.0",
      channel: "release",
      debug: false,
      git_sha: "deadbee",
      git_dirty: true,
      commit_date: "2026-07-10T00:00:00Z",
    },
    isPending: false,
    ...overrides,
  } as ReturnType<typeof useBuildInfo>);
}

const setFolder = vi.fn();
function mockLibrary(folder: string | null) {
  vi.mocked(useLibraryStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector({ folder, setFolder })) as typeof useLibraryStore);
}

const setView = vi.fn();
function mockUi() {
  vi.mocked(useUiStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector({ setView })) as typeof useUiStore);
}

describe("HomeView", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    setFolder.mockReset();
    setView.mockReset();
    installMutate.mockReset();
    mockFfmpeg();
    mockInstall();
    mockJobs();
    mockPresets();
    mockBuildInfo();
    mockLibrary(null);
    mockUi();
  });

  it("shows the app name and tagline", () => {
    render(<HomeView />);
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByText(APP_TAGLINE)).toBeInTheDocument();
  });

  describe("Start panel", () => {
    it("opens the HUD folder browser and navigates to the library once a folder is chosen", () => {
      render(<HomeView />);
      // Nothing happens — no browser, no navigation — until the user asks to choose.
      expect(screen.queryByText("choose-folder-stub")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Ordner wählen" }));
      // The in-app browser opens; choosing a folder drops the user into the Library on it.
      fireEvent.click(screen.getByText("choose-folder-stub"));

      expect(setFolder).toHaveBeenCalledWith("/picked");
      expect(setView).toHaveBeenCalledWith("library");
    });

    it("does not navigate while the browser is open but nothing is chosen yet", () => {
      render(<HomeView />);
      fireEvent.click(screen.getByRole("button", { name: "Ordner wählen" }));
      expect(setFolder).not.toHaveBeenCalled();
      expect(setView).not.toHaveBeenCalled();
    });

    it("shows no Continue control when no folder has been chosen yet", () => {
      render(<HomeView />);
      expect(screen.queryByText(/Weiter zu/)).toBeNull();
    });

    it("shows a Continue control with the current folder once one is chosen", () => {
      mockLibrary("/videos");
      render(<HomeView />);

      fireEvent.click(screen.getByRole("button", { name: "Weiter zu „/videos“" }));

      expect(setView).toHaveBeenCalledWith("library");
    });
  });

  describe("ffmpeg panel", () => {
    it("shows a loading state while discovery is pending", () => {
      mockFfmpeg({ data: undefined, isPending: true });
      render(<HomeView />);
      expect(screen.getByText("Lädt…")).toBeInTheDocument();
    });

    it("shows resolved version and source for ffmpeg and ffprobe when ready", () => {
      render(<HomeView />);
      expect(screen.getAllByText("6.1.1 (path)")).toHaveLength(2);
    });

    it("shows the not-found notice and wires the installer when ffmpeg is missing", () => {
      mockFfmpeg({
        data: {
          ffmpeg: { path: "/opt/ffmpeg", version: "6.0", source: "managed" },
          ffprobe: null,
          ready: false,
        },
      });
      render(<HomeView />);

      expect(screen.getByText(/ffmpeg wurde nicht gefunden/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "ffmpeg installieren" }));
      expect(installMutate).toHaveBeenCalledOnce();
    });
  });

  describe("Activity panel", () => {
    it("shows an idle line when there are no jobs at all", () => {
      render(<HomeView />);
      expect(screen.getByText("Keine Aufgaben in der Warteschlange.")).toBeInTheDocument();
    });

    it("shows running/queued/done counts derived from the job list", () => {
      const jobs: JobDto[] = [
        {
          id: "1",
          input_path: "/a.mp4",
          input_name: "a.mp4",
          output_path: "/out/a.mp4",
          preset_id: "universal",
          state: "Running",
          percent: 40,
          error: null,
        },
        {
          id: "2",
          input_path: "/b.mp4",
          input_name: "b.mp4",
          output_path: "/out/b.mp4",
          preset_id: "universal",
          state: "Queued",
          percent: 0,
          error: null,
        },
        {
          id: "3",
          input_path: "/c.mp4",
          input_name: "c.mp4",
          output_path: "/out/c.mp4",
          preset_id: "universal",
          state: "Done",
          percent: 100,
          error: null,
        },
        {
          id: "4",
          input_path: "/d.mp4",
          input_name: "d.mp4",
          output_path: "/out/d.mp4",
          preset_id: "universal",
          state: "Done",
          percent: 100,
          error: null,
        },
      ];
      mockJobs({ jobs, running: 1, queued: 1, active: true });
      render(<HomeView />);

      expect(screen.getByText("laufend")).toBeInTheDocument();
      expect(screen.getByText("wartend")).toBeInTheDocument();
      expect(screen.getByText("fertig")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument(); // done count
    });
  });

  describe("Presets panel", () => {
    it("shows a loading state while presets are pending", () => {
      mockPresets({ data: undefined, isPending: true });
      render(<HomeView />);
      expect(screen.getAllByText("Lädt…").length).toBeGreaterThan(0);
    });

    it("lists every preset's localized name and description", () => {
      render(<HomeView />);
      expect(screen.getByText("Universal")).toBeInTheDocument();
      expect(
        screen.getByText("Visuell verlustfrei, MP4/H.264 – der empfohlene Standard."),
      ).toBeInTheDocument();
      expect(screen.getByText("Reparieren")).toBeInTheDocument();
      expect(
        screen.getByText("Remuxt die Datei ohne Neucodierung, um Beschädigungen zu beheben."),
      ).toBeInTheDocument();
    });
  });

  describe("Build panel", () => {
    it("renders the build identity once it loads, including a dirty marker", () => {
      render(<HomeView />);
      expect(screen.getByText("v0.2.0")).toBeInTheDocument();
      expect(screen.getByText("release")).toBeInTheDocument();
      expect(screen.getByText("deadbee+")).toBeInTheDocument();
    });

    it("shows placeholders before the build info has loaded", () => {
      mockBuildInfo({ data: undefined });
      render(<HomeView />);
      expect(screen.getAllByText("—").length).toBe(3);
    });
  });
});
