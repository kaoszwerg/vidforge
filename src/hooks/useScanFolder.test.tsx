import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useScanFolder } from "./useScanFolder";

vi.mock("../api/commands", () => ({
  api: { scanFolder: vi.fn() },
}));

import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const files = [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 100 }];

describe("useScanFolder", () => {
  beforeEach(() => {
    vi.mocked(api.scanFolder).mockReset();
  });

  it("scans the given folder via scan_folder", async () => {
    vi.mocked(api.scanFolder).mockResolvedValue(files);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useScanFolder("/videos"), { wrapper: makeWrapper(qc) });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(files);
    expect(api.scanFolder).toHaveBeenCalledWith("/videos");
  });

  it("surfaces a rejected scan (e.g. not a folder) as an error", async () => {
    vi.mocked(api.scanFolder).mockRejectedValue(new Error("not a folder"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useScanFolder("/not-a-folder"), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("is disabled until a folder is chosen", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useScanFolder(null), { wrapper: makeWrapper(qc) });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.scanFolder).not.toHaveBeenCalled();
  });

  it("re-scans automatically when the folder changes", async () => {
    vi.mocked(api.scanFolder).mockResolvedValue(files);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result, rerender } = renderHook(({ folder }) => useScanFolder(folder), {
      wrapper: makeWrapper(qc),
      initialProps: { folder: "/videos" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ folder: "/other" });
    await waitFor(() => expect(api.scanFolder).toHaveBeenCalledWith("/other"));

    expect(api.scanFolder).toHaveBeenCalledTimes(2);
  });
});
