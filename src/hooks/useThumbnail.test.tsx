import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useThumbnail } from "./useThumbnail";

vi.mock("../api/commands", () => ({
  api: { getThumbnail: vi.fn() },
}));

import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useThumbnail", () => {
  beforeEach(() => {
    vi.mocked(api.getThumbnail).mockReset();
  });

  it("loads a thumbnail for the given path via get_thumbnail", async () => {
    vi.mocked(api.getThumbnail).mockResolvedValue("data:image/jpeg;base64,abc");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useThumbnail("/videos/a.mp4"), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe("data:image/jpeg;base64,abc");
    expect(api.getThumbnail).toHaveBeenCalledWith("/videos/a.mp4");
  });

  it("surfaces a rejected thumbnail request as an error", async () => {
    vi.mocked(api.getThumbnail).mockRejectedValue(new Error("ffmpeg failed"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useThumbnail("/videos/broken.mp4"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("is disabled for an empty path", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useThumbnail(""), { wrapper: makeWrapper(qc) });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.getThumbnail).not.toHaveBeenCalled();
  });
});
