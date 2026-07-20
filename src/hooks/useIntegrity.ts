import { useQuery } from "@tanstack/react-query";
import { api } from "../api/commands";

/**
 * Check one file for defects (ADR-PROJ-001). `deep=false` is the fast container/packet check that each
 * card runs automatically as it mounts (the owner's "auto quick check on scan"); `deep=true` fully
 * decodes the stream and is triggered on demand (the Detail view's "deep check", bulk).
 *
 * One query per (path, depth), cached for the session (`staleTime: Infinity`): a file's integrity doesn't
 * change unless the file does, and re-checking on every re-render would re-run ffmpeg. A *defective* file
 * is a normal resolved result (`data.healthy === false`), not a query error — the query only errors if
 * ffmpeg itself can't run (e.g. it isn't installed), which the caller can distinguish from a real defect.
 */
export function useIntegrity(path: string, deep = false, enabled = true) {
  return useQuery({
    queryKey: ["integrity", path, deep],
    queryFn: () => api.checkIntegrity(path, deep),
    enabled: enabled && path.length > 0,
    staleTime: Infinity,
  });
}
