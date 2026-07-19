import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { LibraryView } from "./LibraryView";
import type { SelectModifiers } from "../components/VideoCard";

vi.mock("../hooks/useFfmpegStatus", () => ({ useFfmpegStatus: vi.fn() }));
vi.mock("../hooks/useScanFolder", () => ({ useScanFolder: vi.fn() }));
vi.mock("../hooks/useJobs", () => ({ usePresets: vi.fn(), useEnqueueJob: vi.fn() }));
vi.mock("../store/library", () => ({ useLibraryStore: vi.fn() }));
vi.mock("../api/commands", () => ({ api: { pickFolder: vi.fn() } }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn(), useUpdateSettings: vi.fn() }));

vi.mock("../components/VideoCard", () => ({
  VideoCard: ({
    file,
    onSelect,
    selected,
  }: {
    file: { path: string; name: string };
    onSelect: (p: string, mods: SelectModifiers) => void;
    selected?: boolean;
  }) => (
    <button
      aria-pressed={selected ?? false}
      onClick={(e) => onSelect(file.path, { ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey })}
    >
      {`card:${file.name}`}
    </button>
  ),
}));

vi.mock("./DetailView", () => ({
  DetailView: ({ path, onBack }: { path: string; onBack: () => void }) => (
    <div>
      <span>{`detail:${path}`}</span>
      <button onClick={onBack}>back-stub</button>
    </div>
  ),
}));

vi.mock("../components/ui/Dropzone", () => ({
  Dropzone: ({
    onFolderDropped,
    onBrowse,
    children,
  }: {
    onFolderDropped: (p: string) => void;
    onBrowse: () => void;
    children?: ReactNode;
  }) => (
    <div>
      <button onClick={onBrowse}>browse-stub</button>
      <button onClick={() => onFolderDropped("/dropped")}>drop-stub</button>
      {children}
    </div>
  ),
}));

import { useFfmpegStatus } from "../hooks/useFfmpegStatus";
import { useScanFolder } from "../hooks/useScanFolder";
import { usePresets, useEnqueueJob } from "../hooks/useJobs";
import { useLibraryStore } from "../store/library";
import { api } from "../api/commands";
import { useSettings } from "../hooks/useSettings";

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

function mockScan(overrides: Partial<ReturnType<typeof useScanFolder>> = {}) {
  vi.mocked(useScanFolder).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useScanFolder>);
}

const PRESETS = [
  { id: "universal", container: "mp4", reencodes: true },
  { id: "efficient", container: "mp4", reencodes: true },
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

const enqueueMutate = vi.fn();
function mockEnqueue(overrides: Partial<ReturnType<typeof useEnqueueJob>> = {}) {
  vi.mocked(useEnqueueJob).mockReturnValue({
    mutate: enqueueMutate,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useEnqueueJob>);
}

const setFolder = vi.fn();
const selectVideo = vi.fn();
const selectOnly = vi.fn();
const toggleSelected = vi.fn();
const setSelectedPaths = vi.fn();
const clearSelection = vi.fn();

function mockStore(state: {
  folder: string | null;
  selectedPath: string | null;
  selected?: Set<string>;
  lastClickedPath?: string | null;
}) {
  vi.mocked(useLibraryStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector({
      folder: state.folder,
      selectedPath: state.selectedPath,
      selected: state.selected ?? new Set(),
      lastClickedPath: state.lastClickedPath ?? null,
      setFolder,
      selectVideo,
      selectOnly,
      toggleSelected,
      setSelectedPaths,
      clearSelection,
    })) as typeof useLibraryStore);
}

describe("LibraryView", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    setFolder.mockReset();
    selectVideo.mockReset();
    selectOnly.mockReset();
    toggleSelected.mockReset();
    setSelectedPaths.mockReset();
    clearSelection.mockReset();
    enqueueMutate.mockReset();
    vi.mocked(api.pickFolder).mockReset();
    mockFfmpeg();
    mockScan();
    mockPresets();
    mockEnqueue();
    mockStore({ folder: null, selectedPath: null });
  });

  it("shows a loading state while ffmpeg discovery is pending", () => {
    mockFfmpeg({ data: undefined, isPending: true });
    render(<LibraryView />);
    expect(screen.getByText("Lädt…")).toBeInTheDocument();
  });

  it("shows an error state when ffmpeg discovery itself fails", () => {
    mockFfmpeg({ data: undefined, isError: true, error: new Error("ipc failure") });
    render(<LibraryView />);
    expect(screen.getByText("ipc failure")).toBeInTheDocument();
  });

  it("shows the ffmpeg-missing notice with resolved paths when not ready", () => {
    mockFfmpeg({
      data: {
        ffmpeg: { path: "/opt/ffmpeg", version: "6.0", source: "managed" },
        ffprobe: null,
        ready: false,
      },
    });
    render(<LibraryView />);
    expect(screen.getByText("ffmpeg nicht gefunden")).toBeInTheDocument();
    expect(screen.getByText("/opt/ffmpeg")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // ffprobe not found
  });

  it("shows the Dropzone with the placeholder label when no folder is chosen", () => {
    render(<LibraryView />);
    expect(screen.getByText("Ordner hierher ziehen oder durchsuchen")).toBeInTheDocument();
  });

  it("shows the current folder path once one is chosen", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    render(<LibraryView />);
    expect(screen.getByText("/videos")).toBeInTheDocument();
  });

  it("calls setFolder when the Dropzone reports a dropped folder", () => {
    render(<LibraryView />);
    fireEvent.click(screen.getByRole("button", { name: "drop-stub" }));
    expect(setFolder).toHaveBeenCalledWith("/dropped");
  });

  it("opens the OS folder picker on Browse and sets the folder on success", async () => {
    vi.mocked(api.pickFolder).mockResolvedValue("/picked");
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "browse-stub" }));

    expect(api.pickFolder).toHaveBeenCalledOnce();
    await waitFor(() => expect(setFolder).toHaveBeenCalledWith("/picked"));
  });

  it("does not call setFolder when the picker is cancelled", async () => {
    vi.mocked(api.pickFolder).mockResolvedValue(null);
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "browse-stub" }));

    await waitFor(() => expect(api.pickFolder).toHaveBeenCalledOnce());
    expect(setFolder).not.toHaveBeenCalled();
  });

  it("shows a scanning message while a chosen folder is being scanned", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({ isPending: true });
    render(<LibraryView />);
    expect(screen.getByText("Scanne Ordner…")).toBeInTheDocument();
  });

  it("shows a scan error instead of crashing", () => {
    mockStore({ folder: "/not-a-folder", selectedPath: null });
    mockScan({ isError: true, error: new Error("not a folder") });
    render(<LibraryView />);
    expect(screen.getByText("Scan fehlgeschlagen")).toBeInTheDocument();
    expect(screen.getByText("not a folder")).toBeInTheDocument();
  });

  it("shows the empty-folder message when the scan finds no videos", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({ data: [] });
    render(<LibraryView />);
    expect(screen.getByText("Keine Videos in diesem Ordner gefunden.")).toBeInTheDocument();
  });

  it("renders one card per scanned file", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({
      data: [
        { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 },
        { path: "/videos/b.mkv", name: "b.mkv", extension: "mkv", size_bytes: 2 },
      ],
    });
    render(<LibraryView />);
    expect(screen.getByRole("button", { name: "card:a.mp4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "card:b.mkv" })).toBeInTheDocument();
  });

  it("a plain click narrows the selection to that card and opens the Detail view", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({ data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }] });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "card:a.mp4" }));

    expect(selectOnly).toHaveBeenCalledWith("/videos/a.mp4");
    expect(selectVideo).toHaveBeenCalledWith("/videos/a.mp4");
  });

  it("a Ctrl-click toggles the card without opening the Detail view", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({ data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }] });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "card:a.mp4" }), { ctrlKey: true });

    expect(toggleSelected).toHaveBeenCalledWith("/videos/a.mp4");
    expect(selectVideo).not.toHaveBeenCalled();
    expect(selectOnly).not.toHaveBeenCalled();
  });

  it("a Cmd-click toggles the card without opening the Detail view", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({ data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }] });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "card:a.mp4" }), { metaKey: true });

    expect(toggleSelected).toHaveBeenCalledWith("/videos/a.mp4");
    expect(selectVideo).not.toHaveBeenCalled();
  });

  it("a Shift-click selects the range from the last-clicked card without navigating", () => {
    mockStore({ folder: "/videos", selectedPath: null, lastClickedPath: "/videos/a.mp4" });
    mockScan({
      data: [
        { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 },
        { path: "/videos/b.mp4", name: "b.mp4", extension: "mp4", size_bytes: 1 },
        { path: "/videos/c.mp4", name: "c.mp4", extension: "mp4", size_bytes: 1 },
      ],
    });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "card:c.mp4" }), { shiftKey: true });

    expect(setSelectedPaths).toHaveBeenCalledWith([
      "/videos/a.mp4",
      "/videos/b.mp4",
      "/videos/c.mp4",
    ]);
    expect(selectVideo).not.toHaveBeenCalled();
  });

  it("falls back to a plain selection on Shift-click when there is no range anchor", () => {
    mockStore({ folder: "/videos", selectedPath: null, lastClickedPath: null });
    mockScan({ data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }] });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "card:a.mp4" }), { shiftKey: true });

    expect(selectOnly).toHaveBeenCalledWith("/videos/a.mp4");
    expect(selectVideo).toHaveBeenCalledWith("/videos/a.mp4");
  });

  it("reflects the store's selection on each card", () => {
    mockStore({
      folder: "/videos",
      selectedPath: null,
      selected: new Set(["/videos/a.mp4"]),
    });
    mockScan({
      data: [
        { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 },
        { path: "/videos/b.mp4", name: "b.mp4", extension: "mp4", size_bytes: 1 },
      ],
    });
    render(<LibraryView />);

    expect(screen.getByRole("button", { name: "card:a.mp4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "card:b.mp4" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selects every scanned file on Ctrl+A", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({
      data: [
        { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 },
        { path: "/videos/b.mp4", name: "b.mp4", extension: "mp4", size_bytes: 1 },
      ],
    });
    render(<LibraryView />);

    fireEvent.keyDown(window, { key: "a", ctrlKey: true });

    expect(setSelectedPaths).toHaveBeenCalledWith(["/videos/a.mp4", "/videos/b.mp4"]);
  });

  it("selects every scanned file on Cmd+A", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({
      data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }],
    });
    render(<LibraryView />);

    fireEvent.keyDown(window, { key: "a", metaKey: true });

    expect(setSelectedPaths).toHaveBeenCalledWith(["/videos/a.mp4"]);
  });

  it("does not react to Ctrl+A while the Detail view is open", () => {
    mockStore({ folder: "/videos", selectedPath: "/videos/a.mp4" });
    mockScan({
      data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }],
    });
    render(<LibraryView />);

    fireEvent.keyDown(window, { key: "a", ctrlKey: true });

    expect(setSelectedPaths).not.toHaveBeenCalled();
  });

  it("clears the selection on Escape", () => {
    mockStore({ folder: "/videos", selectedPath: null, selected: new Set(["/videos/a.mp4"]) });
    mockScan({
      data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }],
    });
    render(<LibraryView />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(clearSelection).toHaveBeenCalledOnce();
  });

  it("shows the Detail view instead of the grid once a video is selected", () => {
    mockStore({ folder: "/videos", selectedPath: "/videos/a.mp4" });
    render(<LibraryView />);
    expect(screen.getByText("detail:/videos/a.mp4")).toBeInTheDocument();
  });

  it("clears the selection when the Detail view's back control fires", () => {
    mockStore({ folder: "/videos", selectedPath: "/videos/a.mp4" });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "back-stub" }));

    expect(selectVideo).toHaveBeenCalledWith(null);
  });

  describe("bulk action bar", () => {
    it("is hidden when nothing is selected", () => {
      mockStore({ folder: "/videos", selectedPath: null });
      mockScan({
        data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }],
      });
      render(<LibraryView />);
      expect(screen.queryByText(/ausgewählt/)).toBeNull();
    });

    it("shows the selection count and a preset picker once something is selected", () => {
      mockStore({
        folder: "/videos",
        selectedPath: null,
        selected: new Set(["/videos/a.mp4", "/videos/b.mp4"]),
      });
      mockScan({
        data: [
          { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 },
          { path: "/videos/b.mp4", name: "b.mp4", extension: "mp4", size_bytes: 1 },
        ],
      });
      render(<LibraryView />);

      expect(screen.getByText("2 ausgewählt")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Preset" })).toBeInTheDocument();
    });

    it("enqueues each selected path with the chosen preset and clears the selection", () => {
      mockStore({
        folder: "/videos",
        selectedPath: null,
        selected: new Set(["/videos/a.mp4", "/videos/b.mp4"]),
      });
      mockScan({
        data: [
          { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 },
          { path: "/videos/b.mp4", name: "b.mp4", extension: "mp4", size_bytes: 1 },
        ],
      });
      render(<LibraryView />);

      fireEvent.click(screen.getByRole("button", { name: "Ausgewählte konvertieren" }));

      expect(enqueueMutate).toHaveBeenCalledWith({
        inputPath: "/videos/a.mp4",
        presetId: "universal",
      });
      expect(enqueueMutate).toHaveBeenCalledWith({
        inputPath: "/videos/b.mp4",
        presetId: "universal",
      });
      expect(clearSelection).toHaveBeenCalledOnce();
    });

    it("clears the selection via the Clear-selection control", () => {
      mockStore({
        folder: "/videos",
        selectedPath: null,
        selected: new Set(["/videos/a.mp4"]),
      });
      mockScan({
        data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }],
      });
      render(<LibraryView />);

      fireEvent.click(screen.getByRole("button", { name: "Auswahl aufheben" }));

      expect(clearSelection).toHaveBeenCalledOnce();
    });
  });
});
