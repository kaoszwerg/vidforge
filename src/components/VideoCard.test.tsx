import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VideoCard } from "./VideoCard";

vi.mock("../hooks/useThumbnail", () => ({ useThumbnail: vi.fn() }));
vi.mock("../hooks/useProbe", () => ({ useProbe: vi.fn() }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn(), useUpdateSettings: vi.fn() }));

import { useThumbnail } from "../hooks/useThumbnail";
import { useProbe } from "../hooks/useProbe";
import { useSettings } from "../hooks/useSettings";

const file = { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1_500_000 };

const mediaInfo = {
  path: file.path,
  container: "MP4",
  duration_secs: 75,
  size_bytes: file.size_bytes,
  bit_rate: 1_000_000,
  video: {
    codec: "h264",
    width: 1920,
    height: 1080,
    fps: 30,
    pix_fmt: "yuv420p",
    bit_rate: 900_000,
    hdr: false,
  },
  audio: [],
  subtitles: [],
  quality: "Good" as const,
};

function mockThumb(overrides: Partial<ReturnType<typeof useThumbnail>> = {}) {
  vi.mocked(useThumbnail).mockReturnValue({
    data: undefined,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useThumbnail>);
}

function mockProbe(overrides: Partial<ReturnType<typeof useProbe>> = {}) {
  vi.mocked(useProbe).mockReturnValue({
    data: undefined,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProbe>);
}

describe("VideoCard", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    mockThumb();
    mockProbe();
  });

  it("renders the file name as the card's accessible name", () => {
    render(<VideoCard file={file} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "a.mp4" })).toBeInTheDocument();
  });

  it("calls onSelect with the file path when clicked", () => {
    const onSelect = vi.fn();
    render(<VideoCard file={file} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "a.mp4" }));
    expect(onSelect).toHaveBeenCalledWith("/videos/a.mp4");
  });

  it("shows no image while the thumbnail is still loading", () => {
    const { container } = render(<VideoCard file={file} onSelect={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the thumbnail once loaded", () => {
    mockThumb({ data: "data:image/jpeg;base64,abc" });
    const { container } = render(<VideoCard file={file} onSelect={vi.fn()} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/jpeg;base64,abc");
  });

  it("shows the metadata loading label before the probe resolves", () => {
    render(<VideoCard file={file} onSelect={vi.fn()} />);
    expect(screen.getByText("Lädt…")).toBeInTheDocument();
  });

  it("shows resolution, codec, duration, size and the quality badge once probed", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} />);
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
    expect(screen.getByText("H264")).toBeInTheDocument();
    expect(screen.getByText("1:15")).toBeInTheDocument();
    expect(screen.getByText("1.4 MB")).toBeInTheDocument();
    expect(screen.getByText("Gut")).toBeInTheDocument(); // QualityBadge label for "Good"
  });

  it("shows a small inline error instead of crashing when the probe fails", () => {
    mockProbe({ isError: true, error: new Error("ffprobe failed") });
    render(<VideoCard file={file} onSelect={vi.fn()} />);
    expect(screen.getByText(/ffprobe failed/)).toBeInTheDocument();
    // The card itself is still there and clickable — a probe failure never takes the card down.
    expect(screen.getByRole("button", { name: "a.mp4" })).toBeInTheDocument();
  });

  it("omits resolution/codec when the probe found no video stream", () => {
    mockProbe({ data: { ...mediaInfo, video: null } });
    render(<VideoCard file={file} onSelect={vi.fn()} />);
    expect(screen.queryByText("1920×1080")).toBeNull();
    expect(screen.getByText("1:15")).toBeInTheDocument();
  });
});
