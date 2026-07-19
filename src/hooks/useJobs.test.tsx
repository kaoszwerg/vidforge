import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { ReactNode } from "react";
import { useJobs, usePresets, useEnqueueJob, useCancelJob } from "./useJobs";
import type { JobDto } from "../bindings/JobDto";

vi.mock("../api/commands", () => ({
  api: {
    listJobs: vi.fn(),
    listPresets: vi.fn(),
    enqueueJob: vi.fn(),
    cancelJob: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { api } from "../api/commands";
import { listen } from "@tauri-apps/api/event";

const mockListen = listen as unknown as Mock;

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function job(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: "job-1",
    input_path: "/videos/a.mp4",
    input_name: "a.mp4",
    output_path: "/out/a.mp4",
    preset_id: "universal",
    state: "Queued",
    percent: 0,
    error: null,
    ...overrides,
  };
}

describe("useJobs", () => {
  let handler: ((e: { event: string; id: number; payload: JobDto }) => void) | undefined;

  beforeEach(() => {
    handler = undefined;
    vi.mocked(api.listJobs).mockReset();
    mockListen.mockReset();
    mockListen.mockImplementation(
      (_event: string, cb: (e: { event: string; id: number; payload: JobDto }) => void) => {
        handler = cb;
        return Promise.resolve(() => undefined);
      },
    );
  });

  it("loads the initial snapshot via list_jobs", async () => {
    const snapshot = [job({ id: "a" }), job({ id: "b", state: "Running", percent: 40 })];
    vi.mocked(api.listJobs).mockResolvedValue(snapshot);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useJobs(), { wrapper: makeWrapper(qc) });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.jobs).toEqual(snapshot);
    expect(result.current.running).toBe(1);
    expect(result.current.queued).toBe(1);
    expect(result.current.active).toBe(true);
  });

  it("is inactive with an empty queue", async () => {
    vi.mocked(api.listJobs).mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useJobs(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.active).toBe(false);
    expect(result.current.running).toBe(0);
    expect(result.current.queued).toBe(0);
  });

  it("merges a job://update event onto an existing job, keeping enqueue order", async () => {
    const snapshot = [job({ id: "a" }), job({ id: "b" })];
    vi.mocked(api.listJobs).mockResolvedValue(snapshot);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useJobs(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(listen).toHaveBeenCalledWith("job://update", expect.any(Function)));
    await waitFor(() => expect(result.current.jobs).toEqual(snapshot));

    act(() =>
      handler?.({
        event: "job://update",
        id: 1,
        payload: job({ id: "a", state: "Running", percent: 50 }),
      }),
    );

    await waitFor(() => expect(result.current.jobs.map((j) => j.id)).toEqual(["a", "b"]));
    expect(result.current.jobs[0]).toEqual(job({ id: "a", state: "Running", percent: 50 }));
    expect(result.current.running).toBe(1);
  });

  it("appends a job://update for a job not in the initial snapshot", async () => {
    vi.mocked(api.listJobs).mockResolvedValue([job({ id: "a" })]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useJobs(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(handler).toBeDefined());

    act(() => handler?.({ event: "job://update", id: 2, payload: job({ id: "new" }) }));

    await waitFor(() => expect(result.current.jobs.map((j) => j.id)).toEqual(["a", "new"]));
  });
});

describe("usePresets", () => {
  it("loads the preset list", async () => {
    const presets = [{ id: "universal", container: "mp4", reencodes: true }];
    vi.mocked(api.listPresets).mockResolvedValue(presets);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => usePresets(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.data).toEqual(presets));
  });
});

describe("useEnqueueJob", () => {
  it("writes the enqueued job into the jobs query cache", async () => {
    const created = job({ id: "new" });
    vi.mocked(api.enqueueJob).mockResolvedValue(created);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["jobs"], [job({ id: "a" })]);

    const { result } = renderHook(() => useEnqueueJob(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ inputPath: "/videos/new.mp4", presetId: "universal" });
    });

    expect(api.enqueueJob).toHaveBeenCalledWith("/videos/new.mp4", "universal", undefined);
    expect(qc.getQueryData(["jobs"])).toEqual([job({ id: "a" }), created]);
  });

  it("seeds an empty cache when no jobs query has run yet", async () => {
    const created = job({ id: "new" });
    vi.mocked(api.enqueueJob).mockResolvedValue(created);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useEnqueueJob(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ inputPath: "/videos/new.mp4", presetId: "repair" });
    });

    expect(qc.getQueryData(["jobs"])).toEqual([created]);
  });
});

describe("useCancelJob", () => {
  it("calls the cancel_job command with the id", async () => {
    vi.mocked(api.cancelJob).mockResolvedValue(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useCancelJob(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync("job-1");
    });

    expect(api.cancelJob).toHaveBeenCalledWith("job-1");
  });
});
