import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useProbe } from "./useProbe";

vi.mock("../api/commands", () => ({
  api: { probeMedia: vi.fn() },
}));

import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const mediaInfo = {
  path: "/videos/a.mp4",
  container: "QuickTime / MOV",
  duration_secs: 12.5,
  size_bytes: 1024,
  bit_rate: 500_000,
  video: {
    codec: "h264",
    width: 1920,
    height: 1080,
    fps: 30,
    pix_fmt: "yuv420p",
    bit_rate: 400_000,
    hdr: false,
  },
  audio: [],
  subtitles: [],
  quality: "Good" as const,
};

describe("useProbe", () => {
  beforeEach(() => {
    vi.mocked(api.probeMedia).mockReset();
  });

  it("loads metadata for the given path via probe_media", async () => {
    vi.mocked(api.probeMedia).mockResolvedValue(mediaInfo);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProbe("/videos/a.mp4"), { wrapper: makeWrapper(qc) });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mediaInfo);
    expect(api.probeMedia).toHaveBeenCalledWith("/videos/a.mp4");
  });

  it("surfaces a rejected probe as an error", async () => {
    vi.mocked(api.probeMedia).mockRejectedValue(new Error("ffprobe failed"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProbe("/videos/broken.mp4"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("is disabled for an empty path", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useProbe(""), { wrapper: makeWrapper(qc) });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.probeMedia).not.toHaveBeenCalled();
  });
});
