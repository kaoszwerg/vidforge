import { useQuery } from "@tanstack/react-query";
import { api } from "../api/commands";

/**
 * The folder browser's starting points — standard user directories + mounted drives (ADR-PROJ-001).
 * Cached briefly: roots barely change within a session, but a newly mounted drive should appear if the
 * browser is reopened. Read-only, so no invalidation is needed.
 */
export function useBrowseRoots(enabled = true) {
  return useQuery({
    queryKey: ["browse", "roots"],
    queryFn: () => api.browseRoots(),
    staleTime: 60_000,
    enabled,
  });
}

/**
 * The immediate subfolders of `path` (ADR-PROJ-001) — one query per folder, so a tree node or the
 * content pane loads its children lazily and they stay cached as the user navigates around. `enabled`
 * gates a tree node that hasn't been expanded yet (and an empty path). A folder that can't be opened
 * surfaces as the query's `error`, which the browser renders in place (never a crash, ADR-CORE-037).
 */
export function useBrowseDir(path: string, enabled = true) {
  return useQuery({
    queryKey: ["browse", "dir", path],
    queryFn: () => api.browseDir(path),
    enabled: enabled && path.length > 0,
    staleTime: 30_000,
  });
}
