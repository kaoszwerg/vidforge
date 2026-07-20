import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useBrowseRoots, useBrowseDir } from "./useBrowse";

vi.mock("../api/commands", () => ({ api: { browseRoots: vi.fn(), browseDir: vi.fn() } }));
import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("useBrowse", () => {
  beforeEach(() => {
    vi.mocked(api.browseRoots).mockReset();
    vi.mocked(api.browseDir).mockReset();
  });

  it("useBrowseRoots fetches the roots when enabled", async () => {
    vi.mocked(api.browseRoots).mockResolvedValue([{ label: "Home", path: "/home", kind: "Home" }]);
    const { result } = renderHook(() => useBrowseRoots(true), { wrapper: makeWrapper(newQc()) });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(api.browseRoots).toHaveBeenCalledOnce();
  });

  it("useBrowseRoots does not fetch while disabled (browser closed)", () => {
    renderHook(() => useBrowseRoots(false), { wrapper: makeWrapper(newQc()) });
    expect(api.browseRoots).not.toHaveBeenCalled();
  });

  it("useBrowseDir fetches the subfolders of a path", async () => {
    vi.mocked(api.browseDir).mockResolvedValue([{ name: "clips", path: "/home/clips" }]);
    const { result } = renderHook(() => useBrowseDir("/home", true), {
      wrapper: makeWrapper(newQc()),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(api.browseDir).toHaveBeenCalledWith("/home");
  });

  it("useBrowseDir does not fetch for an empty path or when disabled", () => {
    renderHook(() => useBrowseDir("", true), { wrapper: makeWrapper(newQc()) });
    renderHook(() => useBrowseDir("/home", false), { wrapper: makeWrapper(newQc()) });
    expect(api.browseDir).not.toHaveBeenCalled();
  });
});
