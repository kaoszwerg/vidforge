import { useQuery } from "@tanstack/react-query";
import { api } from "../api/commands";

/** Full technical metadata for one video, read via `ffprobe` (ADR-PROJ-001). Keyed by `path` and
 * cached for 5 minutes: a file's metadata does not change while the Library/Detail view is open, and
 * re-probing on every render would shell out to `ffprobe` far more than necessary. Disabled for an
 * empty path so a not-yet-selected video never fires a request. */
export function useProbe(path: string) {
  return useQuery({
    queryKey: ["probe", path],
    queryFn: () => api.probeMedia(path),
    staleTime: 5 * 60_000,
    enabled: path.length > 0,
  });
}
