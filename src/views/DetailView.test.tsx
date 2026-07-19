import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DetailView } from "./DetailView";

vi.mock("../hooks/useThumbnail", () => ({ useThumbnail: vi.fn() }));
vi.mock("../hooks/useProbe", () => ({ useProbe: vi.fn() }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn(), useUpdateSettings: vi.fn() }));

import { useThumbnail } from "../hooks/useThumbnail";
import { useProbe } from "../hooks/useProbe";
import { useSettings } from "../hooks/useSettings";

const PATH = "C:\\videos\\Trip to the Coast.mp4";

const mediaInfo = {
  path: PATH,
  container: "QuickTime / MOV",
  duration_secs: 3661,
  size_bytes: 1_500_000_000,
  bit_rate: 5_200_000,
  video: {
    codec: "h264",
    width: 1920,
    height: 1080,
    fps: 29.97,
    pix_fmt: "yuv420p",
    bit_rate: 4_900_000,
    hdr: false,
  },
  audio: [{ codec: "aac", channels: 2, sample_rate: 48000, bit_rate: 192_000, language: "eng" }],
  subtitles: [{ codec: "subrip", language: "eng" }],
  quality: "Good" as const,
};

function mockThumb(overrides: Partial<ReturnType<typeof useThumbnail>> = {}) {
  vi.mocked(useThumbnail).mockReturnValue({
    data: undefined,
    ...overrides,
  } as ReturnType<typeof useThumbnail>);
}

function mockProbe(overrides: Partial<ReturnType<typeof useProbe>> = {}) {
  vi.mocked(useProbe).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProbe>);
}

describe("DetailView", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    mockThumb();
    mockProbe();
  });

  it("derives the display name from the path (Windows separators)", () => {
    mockProbe({ data: mediaInfo });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("Trip to the Coast.mp4")).toBeInTheDocument();
  });

  it("calls onBack when the back control is activated", () => {
    const onBack = vi.fn();
    render(<DetailView path={PATH} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows a loading state while the probe is pending", () => {
    mockProbe({ isPending: true });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("Lädt…")).toBeInTheDocument();
  });

  it("shows an error state instead of crashing when the probe fails", () => {
    mockProbe({ isError: true, error: new Error("ffprobe crashed") });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("ffprobe crashed")).toBeInTheDocument();
  });

  it("shows container/duration/size/bitrate", () => {
    mockProbe({ data: mediaInfo });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("QuickTime / MOV")).toBeInTheDocument();
    expect(screen.getByText("1:01:01")).toBeInTheDocument();
    expect(screen.getByText("1.4 GB")).toBeInTheDocument();
    expect(screen.getByText("5.2 Mbps")).toBeInTheDocument();
  });

  it("shows the video stream's resolution, codec, fps, pixfmt and HDR", () => {
    mockProbe({ data: mediaInfo });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
    expect(screen.getByText("H264")).toBeInTheDocument();
    expect(screen.getByText("29.97 fps")).toBeInTheDocument();
    expect(screen.getByText("yuv420p")).toBeInTheDocument();
    expect(screen.getByText("Nein")).toBeInTheDocument(); // hdr: false, German "No"
  });

  it("shows each audio stream", () => {
    mockProbe({ data: mediaInfo });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("AAC")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("48000 Hz")).toBeInTheDocument();
    expect(screen.getByText("192.0 Kbps")).toBeInTheDocument();
    expect(screen.getByText("eng")).toBeInTheDocument();
  });

  it("shows subtitle tracks", () => {
    mockProbe({ data: mediaInfo });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText("subrip — eng")).toBeInTheDocument();
  });

  it("omits the audio and subtitle panels when there are none", () => {
    mockProbe({ data: { ...mediaInfo, audio: [], subtitles: [] } });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.queryByText("AAC")).toBeNull();
    expect(screen.queryByText(/subrip/)).toBeNull();
  });

  it("shows the coming-soon placeholder instead of a player", () => {
    mockProbe({ data: mediaInfo });
    render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(screen.getByText(/bald verfügbar|demnächst/i)).toBeInTheDocument();
  });

  it("shows a thumbnail placeholder icon until the thumbnail loads", () => {
    mockProbe({ data: mediaInfo });
    const { container } = render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the thumbnail once loaded", () => {
    mockProbe({ data: mediaInfo });
    mockThumb({ data: "data:image/jpeg;base64,abc" });
    const { container } = render(<DetailView path={PATH} onBack={vi.fn()} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "data:image/jpeg;base64,abc");
  });
});
