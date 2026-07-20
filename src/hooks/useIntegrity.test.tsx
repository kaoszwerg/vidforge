import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useIntegrity } from "./useIntegrity";

vi.mock("../api/commands", () => ({ api: { checkIntegrity: vi.fn() } }));
import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}
const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const report = (healthy: boolean) => ({
  path: "/v.mp4",
  level: "Quick" as const,
  healthy,
  error_count: healthy ? 0 : 2,
  sample_errors: [],
});

describe("useIntegrity", () => {
  beforeEach(() => vi.mocked(api.checkIntegrity).mockReset());

  it("runs the quick check by default", async () => {
    vi.mocked(api.checkIntegrity).mockResolvedValue(report(true));
    const { result } = renderHook(() => useIntegrity("/v.mp4"), { wrapper: makeWrapper(newQc()) });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(api.checkIntegrity).toHaveBeenCalledWith("/v.mp4", false);
  });

  it("runs the deep check when asked", async () => {
    vi.mocked(api.checkIntegrity).mockResolvedValue(report(false));
    const { result } = renderHook(() => useIntegrity("/v.mp4", true), {
      wrapper: makeWrapper(newQc()),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(api.checkIntegrity).toHaveBeenCalledWith("/v.mp4", true);
  });

  it("does not run while disabled or for an empty path", () => {
    renderHook(() => useIntegrity("/v.mp4", true, false), { wrapper: makeWrapper(newQc()) });
    renderHook(() => useIntegrity("", false), { wrapper: makeWrapper(newQc()) });
    expect(api.checkIntegrity).not.toHaveBeenCalled();
  });
});
