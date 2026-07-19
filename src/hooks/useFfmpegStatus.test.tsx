import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useFfmpegStatus } from "./useFfmpegStatus";

vi.mock("../api/commands", () => ({
  api: { discoverFfmpeg: vi.fn() },
}));

import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useFfmpegStatus", () => {
  beforeEach(() => {
    vi.mocked(api.discoverFfmpeg).mockReset();
  });

  it("loads ffmpeg availability via discover_ffmpeg", async () => {
    const status = {
      ffmpeg: { path: "/usr/bin/ffmpeg", version: "6.1.1", source: "path" },
      ffprobe: { path: "/usr/bin/ffprobe", version: "6.1.1", source: "path" },
      ready: true,
    };
    vi.mocked(api.discoverFfmpeg).mockResolvedValue(status);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useFfmpegStatus(), { wrapper: makeWrapper(qc) });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(status);
    expect(api.discoverFfmpeg).toHaveBeenCalledTimes(1);
  });

  it("surfaces ready:false without treating it as a query error", async () => {
    const status = { ffmpeg: null, ffprobe: null, ready: false };
    vi.mocked(api.discoverFfmpeg).mockResolvedValue(status);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useFfmpegStatus(), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ready).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
