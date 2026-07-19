/**
 * The live job queue (ADR-PROJ-001 §4), driving the status-bar process list and the window-frame
 * activity signal. TanStack Query owns the initial `list_jobs` snapshot (so loading/error are surfaced,
 * not swallowed — rule:frontend-architecture), and every `job://update` event the backend emits on a job
 * change is merged into local state keyed by `id` on top of it — the same snapshot-plus-live-stream split
 * `useLogs` uses for `log://record`. Jobs are kept in **enqueue order**: an update to a job already known
 * replaces it in place; a job not seen before (enqueued, or already queued before this hook mounted) is
 * appended.
 */
import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/commands";
import type { CustomEncode } from "../bindings/CustomEncode";
import type { JobDto } from "../bindings/JobDto";

/** Everything a consumer needs to render the job queue and react to its activity — the return shape of
 * {@link useJobs}, named so `StatusBar`/`App` can pass it down as a single prop instead of re-deriving
 * it (ADR-CORE-005). */
export interface UseJobsResult {
  /** Every known job, in enqueue order. */
  jobs: JobDto[];
  isLoading: boolean;
  error: unknown;
  /** Count of jobs currently `Running`. */
  running: number;
  /** Count of jobs currently `Queued`. */
  queued: number;
  /** Whether the queue has any work in flight (`running + queued > 0`) — drives the window-frame
   * activity signal and the status-bar indicator's energized state. */
  active: boolean;
}

export function useJobs(): UseJobsResult {
  const initial = useQuery({
    queryKey: ["jobs"],
    queryFn: api.listJobs,
  });

  // Jobs created/changed since mount, keyed by id, layered on top of the query snapshot — mirrors
  // useLogs's `appended` state, so a fresh update never needs a setState-in-effect to seed itself.
  const [updates, setUpdates] = useState<Map<string, JobDto>>(new Map());

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<JobDto>("job://update", (e) => {
      setUpdates((prev) => {
        const next = new Map(prev);
        next.set(e.payload.id, e.payload);
        return next;
      });
    }).then((fn) => {
      // The effect may have been cleaned up (component unmounted) before the async subscription
      // resolved; unlisten immediately instead of leaking a handler with nothing left to update
      // (mirrors Dropzone's onDragDropEvent subscription).
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const jobs = useMemo(() => {
    const order: string[] = [];
    const byId = new Map<string, JobDto>();
    const seen = (job: JobDto) => {
      if (!byId.has(job.id)) order.push(job.id);
      byId.set(job.id, job);
    };
    for (const job of initial.data ?? []) seen(job);
    for (const job of updates.values()) seen(job);
    return order.map((id) => byId.get(id)).filter((j): j is JobDto => j !== undefined);
  }, [initial.data, updates]);

  const running = jobs.filter((j) => j.state === "Running").length;
  const queued = jobs.filter((j) => j.state === "Queued").length;

  return {
    jobs,
    isLoading: initial.isLoading,
    error: initial.error,
    running,
    queued,
    active: running + queued > 0,
  };
}

/** The built-in conversion/repair presets (ADR-PROJ-001 §4). Cached for the process lifetime — the
 * backend's preset list is static, not user data. */
export function usePresets() {
  return useQuery({
    queryKey: ["presets"],
    queryFn: api.listPresets,
    staleTime: Infinity,
  });
}

/** Arguments accepted by {@link useEnqueueJob}'s mutation. `custom` is only meaningful for the
 * `"custom"` preset. */
export interface EnqueueJobInput {
  inputPath: string;
  presetId: string;
  custom?: CustomEncode;
}

/** Queue a conversion/repair job. Writes the returned `JobDto` straight into the `["jobs"]` query cache
 * on success — an instant, correct addition to the status-bar list that does not have to wait for the
 * `job://update` round trip (whose listener may not be attached yet on a component that only just
 * mounted). Any later `job://update` for the same id still lands via `useJobs`'s own merge. */
export function useEnqueueJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inputPath, presetId, custom }: EnqueueJobInput) =>
      api.enqueueJob(inputPath, presetId, custom),
    onSuccess: (job) => {
      qc.setQueryData<JobDto[]>(["jobs"], (prev) => {
        if (!prev) return [job];
        const idx = prev.findIndex((j) => j.id === job.id);
        // `Array.prototype.with` (ES2023) rather than `slice()` + bracket assignment: a dynamic
        // numeric index write is exactly what `security/detect-object-injection` flags (see the same
        // reasoning in format.ts/hudButton.ts for reads), and `with` has no such sink — it returns a
        // new array instead of mutating through a computed index.
        return idx === -1 ? [...prev, job] : prev.with(idx, job);
      });
    },
  });
}

/** Cancel a queued or running job by id. No optimistic cache write: the job's terminal `Cancelled`
 * state arrives via `job://update`, which `useJobs` already merges — writing a guessed shape here would
 * only risk racing that event with a stale one. */
export function useCancelJob() {
  return useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
  });
}
