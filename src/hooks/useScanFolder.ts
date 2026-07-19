import { useQuery } from "@tanstack/react-query";
import { api } from "../api/commands";

/** Scan a folder for video files (ADR-PROJ-001), keyed by the folder path: re-selecting a folder
 * already scanned this session reuses the cached listing instead of re-walking the filesystem, and
 * picking a different folder automatically fires a fresh scan (the query key changes). Disabled until
 * a folder is chosen. `recursive` is left to the backend's persisted default — a "rescan" affordance
 * can pass an explicit override later. */
export function useScanFolder(folder: string | null) {
  return useQuery({
    queryKey: ["scan", folder],
    queryFn: () => api.scanFolder(folder as string),
    enabled: folder !== null,
  });
}
