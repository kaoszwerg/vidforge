import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useBulkIntegrityCheck } from "./useBulkIntegrityCheck";
import type { IntegrityReport } from "../bindings/IntegrityReport";

vi.mock("../api/commands", () => ({ api: { checkIntegrity: vi.fn() } }));
import { api } from "../api/commands";

const report = (path: string, healthy: boolean): IntegrityReport => ({
  path,
  level: "Deep",
  healthy,
  error_count: healthy ? 0 : 1,
  sample_errors: healthy ? [] : ["broken"],
});

describe("useBulkIntegrityCheck", () => {
  beforeEach(() => vi.mocked(api.checkIntegrity).mockReset());

  it("deep-checks every path and separates the defective ones", async () => {
    vi.mocked(api.checkIntegrity).mockImplementation(async (p) => report(p, p !== "/bad.mp4"));
    const { result } = renderHook(() => useBulkIntegrityCheck());

    await act(async () => {
      await result.current.start(["/a.mp4", "/bad.mp4", "/c.mp4"]);
    });

    expect(result.current.total).toBe(3);
    expect(result.current.done).toBe(3);
    expect(result.current.running).toBe(false);
    expect(result.current.reports).toHaveLength(3);
    expect(result.current.defective.map((r) => r.path)).toEqual(["/bad.mp4"]);
    // Always the DEEP check.
    expect(api.checkIntegrity).toHaveBeenCalledWith("/bad.mp4", true);
  });

  it("counts a file whose check throws as done, without a report, instead of aborting the batch", async () => {
    vi.mocked(api.checkIntegrity).mockImplementation(async (p) => {
      if (p === "/err.mp4") throw new Error("ffmpeg missing");
      return report(p, true);
    });
    const { result } = renderHook(() => useBulkIntegrityCheck());

    await act(async () => {
      await result.current.start(["/a.mp4", "/err.mp4"]);
    });

    expect(result.current.done).toBe(2);
    expect(result.current.reports).toHaveLength(1);
    expect(result.current.defective).toHaveLength(0);
  });

  it("stops launching further checks once cancelled mid-batch (bounded by the pool)", async () => {
    const { result } = renderHook(() => useBulkIntegrityCheck());
    let calls = 0;
    vi.mocked(api.checkIntegrity).mockImplementation(async (p) => {
      calls += 1;
      if (calls === 1) result.current.cancel(); // the user cancels during the first check
      return report(p, true);
    });

    await act(async () => {
      await result.current.start(["/1", "/2", "/3", "/4", "/5"]);
    });

    // CONCURRENCY (2) checks launch immediately; once cancel has landed the pool pulls no more work, so
    // the last three are never checked.
    expect(calls).toBeLessThanOrEqual(2);
    expect(result.current.running).toBe(false);
  });
});
