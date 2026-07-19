import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { LibraryView } from "./LibraryView";

vi.mock("../hooks/useFfmpegStatus", () => ({ useFfmpegStatus: vi.fn() }));
vi.mock("../hooks/useScanFolder", () => ({ useScanFolder: vi.fn() }));
vi.mock("../store/library", () => ({ useLibraryStore: vi.fn() }));
vi.mock("../api/commands", () => ({ api: { pickFolder: vi.fn() } }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn(), useUpdateSettings: vi.fn() }));

vi.mock("../components/VideoCard", () => ({
  VideoCard: ({
    file,
    onSelect,
  }: {
    file: { path: string; name: string };
    onSelect: (p: string) => void;
  }) => <button onClick={() => onSelect(file.path)}>{`card:${file.name}`}</button>,
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

const setFolder = vi.fn();
const selectVideo = vi.fn();

function mockStore(state: { folder: string | null; selectedPath: string | null }) {
  vi.mocked(useLibraryStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector({ ...state, setFolder, selectVideo })) as typeof useLibraryStore);
}

describe("LibraryView", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    setFolder.mockReset();
    selectVideo.mockReset();
    vi.mocked(api.pickFolder).mockReset();
    mockFfmpeg();
    mockScan();
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

  it("selects a video when its card is clicked", () => {
    mockStore({ folder: "/videos", selectedPath: null });
    mockScan({ data: [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1 }] });
    render(<LibraryView />);

    fireEvent.click(screen.getByRole("button", { name: "card:a.mp4" }));

    expect(selectVideo).toHaveBeenCalledWith("/videos/a.mp4");
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
});
