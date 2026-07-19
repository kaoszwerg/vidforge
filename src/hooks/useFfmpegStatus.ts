import { useQuery } from "@tanstack/react-query";
import { api } from "../api/commands";

/** Availability of the ffmpeg/ffprobe suite (ADR-PROJ-001). Every media feature checks this before
 * scanning/probing/thumbnailing and offers a "not found" state — never a crash — when `ready` is
 * false (ADR-CORE-037). No `staleTime` override: the global default (10s, see `main.tsx`) is short
 * enough to notice a freshly-installed toolchain without the caller having to force a refetch. */
export function useFfmpegStatus() {
  return useQuery({
    queryKey: ["ffmpeg"],
    queryFn: api.discoverFfmpeg,
  });
}
