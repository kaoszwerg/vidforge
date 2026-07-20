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
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "a.mp4" })).toBeInTheDocument();
  });

  it("calls onSelect with the file path and no modifiers on a plain click", () => {
    const onSelect = vi.fn();
    render(<VideoCard file={file} onSelect={onSelect} onToggleSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "a.mp4" }));
    expect(onSelect).toHaveBeenCalledWith("/videos/a.mp4", {
      ctrl: false,
      meta: false,
      shift: false,
    });
  });

  it("reports Ctrl/Cmd and Shift modifiers held during the click", () => {
    const onSelect = vi.fn();
    render(<VideoCard file={file} onSelect={onSelect} onToggleSelect={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "a.mp4" });

    fireEvent.click(btn, { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith("/videos/a.mp4", {
      ctrl: true,
      meta: false,
      shift: false,
    });

    fireEvent.click(btn, { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith("/videos/a.mp4", {
      ctrl: false,
      meta: true,
      shift: false,
    });

    fireEvent.click(btn, { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith("/videos/a.mp4", {
      ctrl: false,
      meta: false,
      shift: true,
    });
  });

  it("is not marked selected by default", () => {
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "a.mp4" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks itself selected via aria-pressed", () => {
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} selected />);
    expect(screen.getByRole("button", { name: "a.mp4" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows no image while the thumbnail is still loading", () => {
    const { container } = render(
      <VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the thumbnail once loaded", () => {
    mockThumb({ data: "data:image/jpeg;base64,abc" });
    const { container } = render(
      <VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/jpeg;base64,abc");
  });

  it("shows the metadata loading label (with a spinner) before the probe resolves", () => {
    const { container } = render(
      <VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />,
    );
    expect(screen.getByText("Lädt…")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("shows resolution, codec, duration, size and the quality badge once probed", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
    expect(screen.getByText("H264")).toBeInTheDocument();
    expect(screen.getByText("1:15")).toBeInTheDocument();
    expect(screen.getByText("1.4 MB")).toBeInTheDocument();
    expect(screen.getByText("Gut")).toBeInTheDocument(); // QualityBadge label for "Good"
  });

  it("lifts the duration to the foreground colour while keeping the technical specs dim", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.getByText("1:15").className).toContain("text-fg");
  });

  it("groups resolution+codec on one line and duration+size on another", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    const specRow = screen.getByText("1920×1080").parentElement;
    expect(specRow?.textContent).toBe("1920×1080·H264");
    const statsRow = screen.getByText("1:15").parentElement;
    expect(statsRow?.textContent).toBe("1:15·1.4 MB");
    expect(specRow).not.toBe(statsRow);
  });

  it("clamps a long title to two lines instead of a single truncated line", () => {
    mockProbe({ data: mediaInfo });
    render(
      <VideoCard
        file={{ ...file, name: "a-very-long-and-descriptive-video-file-name.mp4" }}
        onSelect={vi.fn()}
        onToggleSelect={vi.fn()}
      />,
    );
    const title = screen.getByText("a-very-long-and-descriptive-video-file-name.mp4");
    expect(title.className).toContain("line-clamp-2");
    expect(title.className).not.toContain("truncate");
  });

  it("overlays the quality badge on the thumbnail's top-right corner, mirroring the checkbox", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    const badge = screen.getByText("Gut");
    expect(badge.className).toContain("top-5");
    expect(badge.className).toContain("right-5");

    const checkboxLabel = screen
      .getByRole("checkbox", { name: "„a.mp4“ auswählen" })
      .closest("label");
    expect(checkboxLabel?.className).toContain("top-5");
    expect(checkboxLabel?.className).toContain("left-5");
  });

  it("shows a small inline error instead of crashing when the probe fails", () => {
    mockProbe({ isError: true, error: new Error("ffprobe failed") });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.getByText(/ffprobe failed/)).toBeInTheDocument();
    // The card itself is still there and clickable — a probe failure never takes the card down.
    expect(screen.getByRole("button", { name: "a.mp4" })).toBeInTheDocument();
  });

  it("omits resolution/codec when the probe found no video stream", () => {
    mockProbe({ data: { ...mediaInfo, video: null } });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.queryByText("1920×1080")).toBeNull();
    expect(screen.getByText("1:15")).toBeInTheDocument();
  });

  describe("bulk-select checkbox", () => {
    it("renders a checkbox with the file's name as its accessible name", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      expect(screen.getByRole("checkbox", { name: "„a.mp4“ auswählen" })).toBeInTheDocument();
    });

    it("reflects the selected prop as its checked state", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} selected />);
      expect(screen.getByRole("checkbox", { name: "„a.mp4“ auswählen" })).toBeChecked();
    });

    it("is unchecked when not selected", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      expect(screen.getByRole("checkbox", { name: "„a.mp4“ auswählen" })).not.toBeChecked();
    });

    it("calls onToggleSelect with the file's path when clicked, without opening the card", () => {
      const onToggleSelect = vi.fn();
      const onSelect = vi.fn();
      render(<VideoCard file={file} onSelect={onSelect} onToggleSelect={onToggleSelect} />);

      fireEvent.click(screen.getByRole("checkbox", { name: "„a.mp4“ auswählen" }));

      expect(onToggleSelect).toHaveBeenCalledWith("/videos/a.mp4");
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
