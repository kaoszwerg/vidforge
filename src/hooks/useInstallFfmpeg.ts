/**
 * Drives the in-app ffmpeg installer (ADR-PROJ-001 §2): a mutation over `install_ffmpeg` plus the live
 * `install://progress` stream, mirroring the query-snapshot-plus-live-event split `useJobs`/`useLogs`
 * use for their own backend streams. On success the `["ffmpeg"]` query is invalidated so
 * `useFfmpegStatus` re-discovers the freshly installed suite and the "not found" notice clears itself
 * — no manual cache write, since re-deriving `FfmpegStatus` here would risk drifting from the backend's
 * own discovery logic.
 */
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/commands";
import type { InstallProgress } from "../bindings/InstallProgress";

/** Everything a consumer needs to drive and render the installer — the return shape of
 * {@link useInstallFfmpeg} (ADR-CORE-005). */
export interface UseInstallFfmpegResult {
  /** Start (or retry) the install. */
  install: () => void;
  /** The most recent `install://progress` event since the current attempt started; `null` before the
   * first event of an attempt has arrived, and reset to `null` at the start of every new attempt so a
   * retry never shows the previous attempt's stale phase. */
  progress: InstallProgress | null;
  /** Whether the install mutation is in flight. */
  isInstalling: boolean;
  /** The mutation's rejection, if the last attempt failed at the IPC boundary. A `phase: "error"`
   * progress event can carry the same failure and typically arrives first — callers show whichever is
   * available. */
  error: unknown;
}

export function useInstallFfmpeg(): UseInstallFfmpegResult {
  const qc = useQueryClient();

  // The latest progress event, layered on top of the mutation the same way useJobs/useLogs layer their
  // own live stream on top of a query snapshot — except an install has no "initial snapshot" to load,
  // so this is the whole of the state.
  const [progress, setProgress] = useState<InstallProgress | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<InstallProgress>("install://progress", (e) => {
      setProgress(e.payload);
    }).then((fn) => {
      // The effect may have been cleaned up (component unmounted) before the async subscription
      // resolved; unlisten immediately instead of leaking a handler with nothing left to update
      // (mirrors useJobs's own onDragDropEvent-style subscription).
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

  const mutation = useMutation({
    mutationFn: api.installFfmpeg,
    onMutate: () => {
      setProgress(null);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ffmpeg"] });
    },
  });

  return {
    install: () => mutation.mutate(),
    progress,
    isInstalling: mutation.isPending,
    error: mutation.error,
  };
}
