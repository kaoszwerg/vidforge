import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api } from "../api/commands";

/** A prepared source ready for the `<video>` element: an asset-protocol URL and whether the backend had
 * to transcode (vs. just remux) to produce it — surfaced so the player can show a "transcoded for
 * preview" note (ADR-PROJ-001 §5). */
export interface PreparedSource {
  srcUrl: string;
  transcoded: boolean;
}

/**
 * Prepares a video for the internal player (ADR-PROJ-001 §5): calls `prepare_player`, which probes the
 * source and returns a cached, webview-playable MP4 path — remuxed when already web-friendly,
 * transcoded otherwise (can take a while for a large or exotic file). The absolute `file_path` it
 * returns is turned into a `convertFileSrc` asset-protocol URL the `<video>` element can load directly;
 * seeking is handled by the asset protocol's own HTTP range support, so nothing further is needed here.
 *
 * Cached for the process lifetime per path (`staleTime: Infinity`) — the backend's own cache is already
 * keyed by path+mtime+size, so re-running this for a path already prepared this session would only
 * repeat work the backend has already done. Disabled while `path` is empty, mirroring
 * `useProbe`/`useThumbnail`.
 */
export function usePreparePlayer(path: string) {
  const query = useQuery({
    queryKey: ["player", path],
    queryFn: () => api.preparePlayer(path),
    staleTime: Infinity,
    enabled: path.length > 0,
  });

  const source = useMemo<PreparedSource | undefined>(() => {
    if (!query.data) return undefined;
    return { srcUrl: convertFileSrc(query.data.file_path), transcoded: query.data.transcoded };
  }, [query.data]);

  return {
    source,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}
