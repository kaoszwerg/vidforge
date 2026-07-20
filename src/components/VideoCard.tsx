import { AlertTriangle, Film } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { HudPanel } from "./ui/HudPanel";
import { QualityBadge } from "./QualityBadge";
import { useProbe } from "../hooks/useProbe";
import { useThumbnail } from "../hooks/useThumbnail";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { formatBytes, formatDuration } from "../lib/format";
import type { ScannedFile } from "../bindings/ScannedFile";

/** The click modifiers `VideoCard` reports to `onSelect` — enough for the Library grid's standard-OS
 * multiselect mechanics (plain / Ctrl-Cmd / Shift) without the card needing to know what they mean. */
export interface SelectModifiers {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface VideoCardProps {
  file: ScannedFile;
  /** Called with the file's absolute path and the click's modifier keys when the card is activated —
   * the Library view decides what a plain vs. Ctrl/Cmd vs. Shift click does (ADR-PROJ-001). */
  onSelect: (path: string, modifiers: SelectModifiers) => void;
  /** Called with the file's absolute path when the card's checkbox is toggled — the primary,
   * discoverable way to build a bulk multiselect (Library view's `toggleSelected`), independent of the
   * Ctrl/Cmd/Shift-click mechanics `onSelect` still carries for power users. */
  onToggleSelect: (path: string) => void;
  /** Whether this card is part of the current bulk multiselect (Library view). */
  selected?: boolean;
}

/**
 * One video's card in the Library grid (ADR-PROJ-001): a lazily-loaded thumbnail, the file name, the
 * resolution quality badge and a compact metadata line. The thumbnail (`useThumbnail`) and the full
 * metadata (`useProbe`) are two independent queries — a slow or failed probe never blocks the
 * thumbnail from showing, and vice versa; each renders its own loading/error state instead of the
 * whole card failing (ADR-CORE-037: a single bad file never takes the grid down).
 *
 * The whole card is the click target (`Button` in its unstyled `ghost` variant, so it carries no
 * chamfer/fill of its own and the `HudPanel` visuals show through). It does not decide what a click
 * means — it reports the path plus which modifier keys were held to `onSelect`, and the Library view
 * (which owns the bulk-selection store and the grid order Shift-click needs) interprets them.
 *
 * A `Checkbox` overlays the thumbnail's top-left corner as a **sibling** of the card's `Button`, not a
 * descendant of it — nesting a native interactive control inside a `<button>` is invalid HTML (the
 * parser would split the button), so the two sit side by side in a `relative` wrapper instead, with the
 * checkbox stacked above via `z-10`. That also means a click on it never reaches the button underneath
 * by simple DOM hit-testing; `stopPropagation` in the change handler is a defensive second guard.
 */
export function VideoCard({ file, onSelect, onToggleSelect, selected = false }: VideoCardProps) {
  const t = useT();
  const thumb = useThumbnail(file.path);
  const probe = useProbe(file.path);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onSelect(file.path, { ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey });
  };

  return (
    <div className="relative">
      <Checkbox
        checked={selected}
        onChange={() => onToggleSelect(file.path)}
        label={t("library.card.select", { name: file.name })}
        /* Overlaid ON the thumbnail's top-left corner: the panel's p-4 (16px) + hud-clip (14px chamfer)
           mean anything inside ~17px sits over the clipped-away corner and reads as "outside" the card,
           so the checkbox is inset past that onto the thumbnail itself. */
        className="absolute top-5 left-5 z-10"
        onClick={(e) => e.stopPropagation()}
      />
      <Button
        variant="ghost"
        onClick={handleClick}
        className="block w-full p-0 text-left"
        aria-label={file.name}
        aria-pressed={selected}
      >
        <HudPanel
          accent={selected ? "green" : "cyan"}
          className={`hover:neon-glow-cyan overflow-hidden transition-shadow ${selected ? "neon-glow-green" : ""}`}
        >
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
    </div>
  );
}
