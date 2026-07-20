import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VideoPlayer } from "./VideoPlayer";
import { settingsDto } from "../test/settings";

vi.mock("../hooks/usePreparePlayer", () => ({ usePreparePlayer: vi.fn() }));
vi.mock("../api/commands", () => ({ api: { getSettings: vi.fn() } }));

import { usePreparePlayer } from "../hooks/usePreparePlayer";
import { api } from "../api/commands";

// jsdom does not implement HTMLMediaElement.play()/pause() (they log "Not implemented" and play()
// returns undefined instead of a Promise) — stubbed for every test so VideoPlayer's `.play().catch(...)`
// has a real Promise to chain onto, exactly like a real webview's <video> provides.
function stubMediaMethods() {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
}

function mockPlayer(overrides: Partial<ReturnType<typeof usePreparePlayer>> = {}) {
  vi.mocked(usePreparePlayer).mockReturnValue({
    source: undefined,
    isPending: true,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof usePreparePlayer>);
}

function renderPlayer(path = "/videos/a.mp4") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VideoPlayer path={path} />
    </QueryClientProvider>,
  );
}

const READY_SOURCE = { srcUrl: "asset://localhost/cache/vidforge/a.mp4", transcoded: false };

describe("VideoPlayer", () => {
  beforeEach(() => {
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
    stubMediaMethods();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Only present on HTMLElement.prototype when a test explicitly adds it (jsdom has no Fullscreen API
    // — see the fullscreen tests below); remove it so it never leaks into another test file.
    delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen;
  });

  it("shows a preparing state while the source is not ready", async () => {
    mockPlayer({ isPending: true, source: undefined });
    renderPlayer();
    expect(await screen.findByText("Vorschau wird vorbereitet…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows a localized error when preparation fails", async () => {
    mockPlayer({ isPending: false, isError: true, error: new Error("ffmpeg missing") });
    renderPlayer();
    expect(
      await screen.findByText("Vorschau konnte nicht vorbereitet werden: ffmpeg missing"),
    ).toBeInTheDocument();
  });

  it("renders the video with the prepared source and no native controls", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    await screen.findByRole("button", { name: "Abspielen" });
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", READY_SOURCE.srcUrl);
    expect(video).not.toHaveAttribute("controls");
  });

  it("omits the transcoded note for a source that was only remuxed", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    renderPlayer();
    await screen.findByRole("button", { name: "Abspielen" });
    expect(screen.queryByText("Für die Vorschau transkodiert.")).toBeNull();
  });

  it("shows the transcoded note when the source was transcoded", async () => {
    mockPlayer({ isPending: false, source: { ...READY_SOURCE, transcoded: true } });
    renderPlayer();
    expect(await screen.findByText("Für die Vorschau transkodiert.")).toBeInTheDocument();
  });

  it("toggles play/pause and drives the underlying video element", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    const video = container.querySelector("video") as HTMLVideoElement;
    // jsdom's `paused` never flips itself (play()/pause() are stubbed above and jsdom's own
    // implementation is a no-op either way) — made writable so the test can move it the same way a
    // real browser would once play/pause actually take effect.
    Object.defineProperty(video, "paused", { value: true, writable: true, configurable: true });

    fireEvent.click(await screen.findByRole("button", { name: "Abspielen" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();

    Object.defineProperty(video, "paused", { value: false, writable: true, configurable: true });
    fireEvent.play(video);
    const pauseBtn = await screen.findByRole("button", { name: "Pause" });

    fireEvent.click(pauseBtn);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledOnce();

    Object.defineProperty(video, "paused", { value: true, writable: true, configurable: true });
    fireEvent.pause(video);
    expect(await screen.findByRole("button", { name: "Abspielen" })).toBeInTheDocument();
  });

  it("updates the displayed time and the seek slider from loadedmetadata/timeupdate", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    const video = container.querySelector("video") as HTMLVideoElement;

    Object.defineProperty(video, "duration", { value: 125, writable: true, configurable: true });
    fireEvent.loadedMetadata(video);
    expect(await screen.findByText("2:05")).toBeInTheDocument();

    Object.defineProperty(video, "currentTime", { value: 65, writable: true, configurable: true });
    fireEvent.timeUpdate(video);
    expect(await screen.findByText("1:05")).toBeInTheDocument();

    const seek = screen.getByRole("slider", { name: "Wiedergabeposition" }) as HTMLInputElement;
    expect(seek).not.toBeDisabled();
    expect(seek.value).toBe("65");
  });

  it("disables the seek slider until the video reports a duration", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    renderPlayer();
    expect(await screen.findByRole("slider", { name: "Wiedergabeposition" })).toBeDisabled();
  });

  it("seeks the video when the seek slider changes", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 100, writable: true, configurable: true });
    fireEvent.loadedMetadata(video);

    const seek = await screen.findByRole("slider", { name: "Wiedergabeposition" });
    fireEvent.change(seek, { target: { value: "42" } });

    expect(video.currentTime).toBe(42);
    expect(await screen.findByText("0:42")).toBeInTheDocument();
  });

  it("puts the seek bar's flex sizing on its wrapper, not on the slider primitive (regression)", async () => {
    // Regression guard for the collapsed-to-a-dot bug: `Slider` forces `w-full`, so passing `flex-1`
    // straight to it produced two competing width utilities and the seek bar rendered as a dot while the
    // volume bar blew up to full width. The sizing must live on the wrapper; the slider only fills it.
    mockPlayer({ isPending: false, source: READY_SOURCE });
    renderPlayer();
    const seek = await screen.findByRole("slider", { name: "Wiedergabeposition" });
    expect(seek.className).not.toContain("flex-1");
    expect(seek.parentElement?.className).toContain("flex-1");
  });

  it("hides the volume slider below the sm breakpoint but keeps the mute button", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    renderPlayer();
    const muteBtn = await screen.findByRole("button", { name: "Stummschalten" });
    expect(muteBtn.className).not.toContain("hidden");

    // The responsive hide lives on the slider's sizing wrapper, not the slider primitive itself: the
    // `Slider` forces its own `w-full`, so width/visibility classes must sit on the wrapper to avoid a
    // width-utility collision (the bug that collapsed the seek bar to a dot). Assert on that wrapper.
    const volumeWrapper = screen.getByRole("slider", { name: "Lautstärke" }).parentElement;
    expect(volumeWrapper?.className).toContain("hidden");
    expect(volumeWrapper?.className).toContain("sm:block");
  });

  it("mutes and unmutes via the mute button", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    const video = container.querySelector("video") as HTMLVideoElement;

    fireEvent.click(await screen.findByRole("button", { name: "Stummschalten" }));
    expect(video.muted).toBe(true);

    const unmuteBtn = await screen.findByRole("button", { name: "Stummschaltung aufheben" });
    fireEvent.click(unmuteBtn);
    expect(video.muted).toBe(false);
  });

  it("sets the video's volume from the volume slider and un-mutes when raised above zero", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    const video = container.querySelector("video") as HTMLVideoElement;

    fireEvent.click(await screen.findByRole("button", { name: "Stummschalten" }));
    expect(video.muted).toBe(true);

    const volumeSlider = screen.getByRole("slider", { name: "Lautstärke" });
    fireEvent.change(volumeSlider, { target: { value: "0.6" } });

    expect(video.volume).toBe(0.6);
    expect(video.muted).toBe(false);
    expect(screen.getByRole("button", { name: "Stummschalten" })).toBeInTheDocument();
  });

  it("shows a localized playback error and removes the video on the video element's error event", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container } = renderPlayer();
    const video = container.querySelector("video") as HTMLVideoElement;

    fireEvent.error(video);

    expect(await screen.findByText("Wiedergabe fehlgeschlagen.")).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
  });

  it("does nothing (no throw) when the Fullscreen API is unavailable", async () => {
    mockPlayer({ isPending: false, source: READY_SOURCE });
    renderPlayer();
    const fsBtn = await screen.findByRole("button", { name: "Vollbild" });
    expect(() => fireEvent.click(fsBtn)).not.toThrow();
  });

  it("requests fullscreen on the player container when the fullscreen button is clicked", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen =
      requestFullscreen;
    mockPlayer({ isPending: false, source: READY_SOURCE });
    renderPlayer();

    fireEvent.click(await screen.findByRole("button", { name: "Vollbild" }));
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("resets transport state when the prepared source changes", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockPlayer({ isPending: false, source: READY_SOURCE });
    const { container, rerender } = render(
      <QueryClientProvider client={qc}>
        <VideoPlayer path="/videos/a.mp4" />
      </QueryClientProvider>,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { value: 100, writable: true, configurable: true });
    fireEvent.loadedMetadata(video);
    Object.defineProperty(video, "currentTime", { value: 50, writable: true, configurable: true });
    fireEvent.timeUpdate(video);
    expect(await screen.findByText("0:50")).toBeInTheDocument();

    mockPlayer({
      isPending: false,
      source: { srcUrl: "asset://localhost/cache/vidforge/b.mp4", transcoded: false },
    });
    rerender(
      <QueryClientProvider client={qc}>
        <VideoPlayer path="/videos/b.mp4" />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText("0:00")).toHaveLength(2);
  });
});
