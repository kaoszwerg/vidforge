import { AlertTriangle, Film } from "lucide-react";
import { Button } from "./ui/Button";
import { HudPanel } from "./ui/HudPanel";
import { QualityBadge } from "./QualityBadge";
import { useProbe } from "../hooks/useProbe";
import { useThumbnail } from "../hooks/useThumbnail";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { formatBytes, formatDuration } from "../lib/format";
import type { ScannedFile } from "../bindings/ScannedFile";

export interface VideoCardProps {
  file: ScannedFile;
  /** Called with the file's absolute path when the card is activated. */
  onSelect: (path: string) => void;
}

/**
 * One video's card in the Library grid (ADR-PROJ-001): a lazily-loaded thumbnail, the file name, the
 * resolution quality badge and a compact metadata line. The thumbnail (`useThumbnail`) and the full
 * metadata (`useProbe`) are two independent queries — a slow or failed probe never blocks the
 * thumbnail from showing, and vice versa; each renders its own loading/error state instead of the
 * whole card failing (ADR-CORE-037: a single bad file never takes the grid down).
 *
 * The whole card is the click target (`Button` in its unstyled `ghost` variant, so it carries no
 * chamfer/fill of its own and the `HudPanel` visuals show through) — clicking it hands the file's path
 * to `onSelect`, which the Library view uses to open the Detail view.
 */
export function VideoCard({ file, onSelect }: VideoCardProps) {
  const t = useT();
  const thumb = useThumbnail(file.path);
  const probe = useProbe(file.path);

  return (
    <Button
      variant="ghost"
      onClick={() => onSelect(file.path)}
      className="block w-full p-0 text-left"
      aria-label={file.name}
    >
      <HudPanel accent="cyan" className="hover:neon-glow-cyan overflow-hidden transition-shadow">
        <div className="flex flex-col gap-2">
          <div className="hud-clip-sm bg-elevated relative flex aspect-video w-full items-center justify-center overflow-hidden">
            {thumb.data ? (
              <img src={thumb.data} alt="" className="h-full w-full object-cover" />
            ) : thumb.isError ? (
              <AlertTriangle size={22} className="text-danger" aria-hidden />
            ) : (
              <Film size={22} className="text-dim animate-pulse" aria-hidden />
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-fg truncate text-sm">{file.name}</span>
            {probe.data ? <QualityBadge tier={probe.data.quality} className="shrink-0" /> : null}
          </div>

          <div className="text-dim flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]">
            {probe.data ? (
              <>
                {probe.data.video ? (
                  <span>
                    {probe.data.video.width}×{probe.data.video.height}
                  </span>
                ) : null}
                {probe.data.video ? <span>{probe.data.video.codec.toUpperCase()}</span> : null}
                <span>{formatDuration(probe.data.duration_secs ?? 0)}</span>
                <span>{formatBytes(file.size_bytes)}</span>
              </>
            ) : probe.isError ? (
              <span className="text-danger flex items-center gap-1">
                <AlertTriangle size={11} aria-hidden />
                {t("library.card.probeError", { message: errorMessage(probe.error) })}
              </span>
            ) : (
              <span>{t("common.loading")}</span>
            )}
          </div>
        </div>
      </HudPanel>
    </Button>
  );
}
