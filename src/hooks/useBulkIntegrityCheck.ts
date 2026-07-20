import { useCallback, useRef, useState } from "react";
import { api } from "../api/commands";
import type { IntegrityReport } from "../bindings/IntegrityReport";

/** Deep checks fully decode the video and are CPU-heavy, so only a few run at once — enough to use the
 * machine, few enough to keep it responsive. (The conversion job queue is deliberately not reused: a
 * check produces a verdict, not an output file, and "defective" is a normal result, not a failed job.) */
const CONCURRENCY = 2;

export interface BulkIntegrityState {
  /** True while checks are still running. */
  running: boolean;
  /** How many files were requested. */
  total: number;
  /** How many have completed (healthy, defective, or skipped on error). */
  done: number;
  /** The reports gathered so far, in completion order. */
  reports: IntegrityReport[];
}

const IDLE: BulkIntegrityState = { running: false, total: 0, done: 0, reports: [] };

/**
 * Run a **deep** integrity check over many files at once (ADR-PROJ-001), with a small concurrency pool so
 * the machine stays usable and live progress (`done`/`total`). `cancel` stops launching further checks —
 * the few already in flight finish (an ffmpeg decode can't be torn down from here), which the fixed pool
 * bounds. A file whose check errors (e.g. ffmpeg missing) is counted done but produces no report, rather
 * than aborting the batch (ADR-CORE-037). `defective` is the sub-list a caller can hand to bulk repair.
 */
export function useBulkIntegrityCheck() {
  const [state, setState] = useState<BulkIntegrityState>(IDLE);
  const cancelRef = useRef(false);

  const start = useCallback(async (paths: string[]) => {
    cancelRef.current = false;
    setState({ running: true, total: paths.length, done: 0, reports: [] });
    const queue = [...paths];
    const reports: IntegrityReport[] = [];

    const worker = async () => {
      for (
        let next = queue.shift();
        next !== undefined && !cancelRef.current;
        next = queue.shift()
      ) {
        try {
          reports.push(await api.checkIntegrity(next, true));
        } catch {
          // ffmpeg unavailable / a read failure: skip this file rather than fail the whole batch.
        }
        setState((s) => ({ ...s, done: s.done + 1, reports: [...reports] }));
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, paths.length) }, worker));
    setState((s) => ({ ...s, running: false }));
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);
  const reset = useCallback(() => {
    cancelRef.current = true;
    setState(IDLE);
  }, []);

  const defective = state.reports.filter((r) => !r.healthy);
  return { ...state, defective, start, cancel, reset };
}
