import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { usePreparePlayer } from "./usePreparePlayer";

vi.mock("../api/commands", () => ({
  api: { preparePlayer: vi.fn() },
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

import { api } from "../api/commands";
import { convertFileSrc } from "@tauri-apps/api/core";

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("usePreparePlayer", () => {
  beforeEach(() => {
    vi.mocked(api.preparePlayer).mockReset();
    vi.mocked(convertFileSrc).mockClear();
  });

  it("prepares the source via prepare_player and turns file_path into an asset URL", async () => {
    vi.mocked(api.preparePlayer).mockResolvedValue({
      file_path: "/cache/vidforge/abc123.mp4",
      transcoded: false,
      direct: false,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePreparePlayer("/videos/a.mp4"), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.source).toBeDefined());

    expect(api.preparePlayer).toHaveBeenCalledWith("/videos/a.mp4");
    expect(convertFileSrc).toHaveBeenCalledWith("/cache/vidforge/abc123.mp4");
    expect(result.current.source).toEqual({
      srcUrl: "asset://localhost//cache/vidforge/abc123.mp4",
      transcoded: false,
    });
  });

  it("surfaces whether the source had to be transcoded", async () => {
    vi.mocked(api.preparePlayer).mockResolvedValue({
      file_path: "/cache/vidforge/def456.mp4",
      transcoded: true,
      direct: false,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePreparePlayer("/videos/exotic.avi"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.source?.transcoded).toBe(true));
  });

  it("plays a directly-playable source from its original path (backend returned it untouched)", async () => {
    // The backend short-circuits a web-playable source: `file_path` is the ORIGINAL, not a cache copy.
    // The hook doesn't care which it is — it turns whatever `file_path` came back into the asset URL — so
    // this pins that a direct source plays from its own path with no cache path involved.
    vi.mocked(api.preparePlayer).mockResolvedValue({
      file_path: "/videos/original.mp4",
      transcoded: false,
      direct: true,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePreparePlayer("/videos/original.mp4"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.source).toBeDefined());
    expect(convertFileSrc).toHaveBeenCalledWith("/videos/original.mp4");
    expect(result.current.source?.srcUrl).toBe("asset://localhost//videos/original.mp4");
  });

  it("surfaces a rejected preparation as an error", async () => {
    vi.mocked(api.preparePlayer).mockRejectedValue(new Error("ffmpeg not found"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePreparePlayer("/videos/broken.mkv"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.source).toBeUndefined();
  });

  it("is disabled for an empty path", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePreparePlayer(""), { wrapper: makeWrapper(qc) });

    expect(result.current.isPending).toBe(true);
    expect(api.preparePlayer).not.toHaveBeenCalled();
  });
});
