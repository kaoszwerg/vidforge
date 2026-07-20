import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VideoCard } from "./VideoCard";

vi.mock("../hooks/useThumbnail", () => ({ useThumbnail: vi.fn() }));
vi.mock("../hooks/useProbe", () => ({ useProbe: vi.fn() }));
vi.mock("../hooks/useIntegrity", () => ({ useIntegrity: vi.fn() }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn(), useUpdateSettings: vi.fn() }));

import { useThumbnail } from "../hooks/useThumbnail";
import { useProbe } from "../hooks/useProbe";
import { useIntegrity } from "../hooks/useIntegrity";
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

function mockIntegrity(overrides: Partial<ReturnType<typeof useIntegrity>> = {}) {
  vi.mocked(useIntegrity).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useIntegrity>);
}

describe("VideoCard", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    mockThumb();
    mockProbe();
    mockIntegrity();
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

  it("colours the duration with the gold accent while keeping the exact specs dim", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    expect(screen.getByText("1:15").className).toContain("text-gold");
  });

  it("shows the resolution tier and codec as colour-coded badges, exact specs on a secondary line", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
    // Badge row: the scannable, colour-coded facts — resolution tier (quality-tinted) + codec (cyan).
    expect(screen.getByText("1080p")).toBeInTheDocument();
    expect(screen.getByText("H264")).toBeInTheDocument();
    // Secondary line groups the exact dimensions, duration and size together, demoted below the badges.
    const statsRow = screen.getByText("1920×1080").parentElement;
    expect(statsRow?.textContent).toContain("1920×1080");
    expect(statsRow?.textContent).toContain("1:15");
    expect(statsRow?.textContent).toContain("1.4 MB");
    // The badges are not on that same secondary line.
    expect(statsRow?.textContent).not.toContain("1080p");
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

  describe("uniform card size (owner feedback: all cards must be the same size)", () => {
    it("reserves a fixed two-line height for the title regardless of a one-line name", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      expect(screen.getByText("a.mp4").className).toContain("min-h-10");
    });

    it("reserves the metadata block's minimum height while the probe is still loading", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      const loadingMeta = screen.getByText("Lädt…").closest("div");
      expect(loadingMeta?.className).toContain("min-h-[42px]");
    });

    it("reserves the same metadata block minimum height once the probe has resolved", () => {
      mockProbe({ data: mediaInfo });
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      const loadedMeta = screen.getByText("1920×1080").closest("div")?.parentElement;
      expect(loadedMeta?.className).toContain("min-h-[42px]");
    });

    it("clamps a long probe-error message to two lines instead of growing past the reserved block", () => {
      mockProbe({
        isError: true,
        error: new Error("a very long ffprobe failure message".repeat(4)),
      });
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      const message = screen.getByText(/ffprobe failure message/);
      expect(message.className).toContain("line-clamp-2");
    });

    it("keeps the badge row (audio-only) with its reserved height when the probe found no video stream", () => {
      mockProbe({ data: { ...mediaInfo, video: null } });
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      // With no video stream the badge row shows the "audio only" badge instead of resolution+codec, but
      // it still occupies its fixed height so the card stays the same size as its video-bearing siblings.
      const statsRow = screen.getByText("1:15").parentElement;
      const badgeRow = statsRow?.previousElementSibling;
      expect(badgeRow).not.toBeNull();
      expect(badgeRow?.className).toContain("h-[18px]");
      expect(badgeRow?.textContent).toBe("Nur Audio");
    });

    it("fills its grid cell top-to-bottom: wrapper + panel are h-full, click target covers via inset-0", () => {
      const { container } = render(
        <VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />,
      );
      const wrapper = container.firstElementChild;
      expect(wrapper?.className).toContain("h-full");
      // The visual panel fills the cell...
      expect(container.querySelector(".hud-panel")?.className).toContain("h-full");
      // ...and the click-target button covers the whole card via `absolute inset-0` — it is now a
      // sibling of the panel, not its ancestor (a native checkbox can't be nested inside a <button>).
      const button = screen.getByRole("button", { name: "a.mp4" });
      expect(button.className).toContain("inset-0");
    });
  });

  // The reveal/position classes live on the checkbox's absolutely-positioned WRAPPER div (the label's
  // parent), not on the `<label>` itself — the label carries `.hud-btn { position: relative }`, which
  // would beat a Tailwind `absolute` on the same element, so positioning + reveal sit one level up (see
  // VideoCard's doc comment). This helper reaches that wrapper.
  const checkboxWrapper = (name: string) =>
    screen.getByRole("checkbox", { name }).closest("label")?.parentElement;

  describe("checkbox hover/selection reveal (P2.3)", () => {
    it("hides the checkbox at rest when nothing is selected", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      const wrapper = checkboxWrapper("„a.mp4“ auswählen");
      expect(wrapper?.className).toContain("opacity-0");
      expect(wrapper?.className).toContain("group-hover:opacity-100");
      expect(wrapper?.className).toContain("group-focus-within:opacity-100");
    });

    it("keeps the checkbox visible when this card is itself checked", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} selected />);
      const wrapper = checkboxWrapper("„a.mp4“ auswählen");
      expect(wrapper?.className).toContain("opacity-100");
      expect(wrapper?.className).not.toContain("opacity-0");
    });

    it("keeps the checkbox visible on every card while any bulk selection is active", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} anySelected />);
      const wrapper = checkboxWrapper("„a.mp4“ auswählen");
      expect(wrapper?.className).toContain("opacity-100");
      expect(wrapper?.className).not.toContain("opacity-0");
    });

    it("stays keyboard-reachable while visually hidden (hidden via opacity, not display/visibility)", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      const checkbox = screen.getByRole("checkbox", { name: "„a.mp4“ auswählen" });
      checkbox.focus();
      expect(checkbox).toHaveFocus();
    });

    it("puts the checkbox on a smaller (sm) box than the default", () => {
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      const label = screen.getByRole("checkbox", { name: "„a.mp4“ auswählen" }).closest("label");
      expect(label?.className).toContain("h-5");
      expect(label?.className).toContain("w-5");
    });

    it("wraps the card in a group so hover/focus-within can reveal the checkbox", () => {
      const { container } = render(
        <VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />,
      );
      expect(container.firstElementChild?.className).toContain("group");
    });
  });

  it("overlays the quality badge on the thumbnail's top-right corner, mirroring the checkbox", () => {
    mockProbe({ data: mediaInfo });
    render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} selected />);
    const badge = screen.getByText("Gut");
    // Both overlays sit INSIDE the thumbnail's own corners (`top-2` = 8px in), so they lie on the preview
    // image and never touch the card's neon border (owner feedback, 3rd iteration).
    expect(badge.className).toContain("top-2");
    expect(badge.className).toContain("right-2");

    // `selected` forces the checkbox visible so its wrapper's inset classes can be asserted
    // deterministically — see the reveal describe block above for the hover/selection reveal logic.
    const wrapper = checkboxWrapper("„a.mp4“ auswählen");
    expect(wrapper?.className).toContain("top-2");
    expect(wrapper?.className).toContain("left-2");
  });

  describe("defect flag (auto quick integrity check)", () => {
    it("flags a defective file with a danger badge", () => {
      mockIntegrity({
        data: {
          path: file.path,
          level: "Quick",
          healthy: false,
          error_count: 3,
          sample_errors: [],
        },
      } as Partial<ReturnType<typeof useIntegrity>>);
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      expect(screen.getByText("Defekt")).toBeInTheDocument();
    });

    it("shows no defect badge for a healthy file", () => {
      mockIntegrity({
        data: { path: file.path, level: "Quick", healthy: true, error_count: 0, sample_errors: [] },
      } as Partial<ReturnType<typeof useIntegrity>>);
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      expect(screen.queryByText("Defekt")).toBeNull();
    });

    it("shows no defect badge before the check has resolved", () => {
      mockIntegrity({ data: undefined, isPending: true } as Partial<
        ReturnType<typeof useIntegrity>
      >);
      render(<VideoCard file={file} onSelect={vi.fn()} onToggleSelect={vi.fn()} />);
      expect(screen.queryByText("Defekt")).toBeNull();
    });
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
