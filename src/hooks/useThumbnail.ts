import { useQuery } from "@tanstack/react-query";
import { api } from "../api/commands";

/** One representative-frame thumbnail for a video (ADR-PROJ-001), as a `data:image/jpeg;base64,...`
 * URI. Cached for the process lifetime: the backend already keys its own on-disk cache by
 * path+mtime+size, so a thumbnail the frontend has fetched once never needs re-fetching in the same
 * session. Disabled for an empty path so a not-yet-selected video never fires a request. */
export function useThumbnail(path: string) {
  return useQuery({
    queryKey: ["thumb", path],
    queryFn: () => api.getThumbnail(path),
    staleTime: Infinity,
    enabled: path.length > 0,
  });
}
