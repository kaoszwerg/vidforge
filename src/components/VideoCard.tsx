import { AlertTriangle, Clock, Film, HardDrive, Loader2 } from "lucide-react";
import type { MouseEvent } from "react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { HudPanel } from "./ui/HudPanel";
import { QualityBadge } from "./QualityBadge";
import { useProbe } from "../hooks/useProbe";
import { useThumbnail } from "../hooks/useThumbnail";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { formatBytes, formatDuration, resolutionLabel } from "../lib/format";
import { accentForTier } from "../lib/quality";
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
  /** Whether *any* card in the grid is currently selected (Library view's `selected.size > 0`) — while
   * true, every card's checkbox stays visible (not just the hovered/focused one), so bulk-selecting more
   * files doesn't require re-discovering the hover affordance card by card (P2.3). */
  anySelected?: boolean;
}

/**
 * One video's card in the Library grid (ADR-PROJ-001): a lazily-loaded thumbnail, the file name, the
 * resolution quality badge and a compact metadata line. The thumbnail (`useThumbnail`) and the full
 * metadata (`useProbe`) are two independent queries — a slow or failed probe never blocks the
 * thumbnail from showing, and vice versa; each renders its own loading/error state instead of the
 * whole card failing (ADR-CORE-037: a single bad file never takes the grid down).
 *
 * **Uniform card size** (design review P2.1): every card renders at the exact same size regardless of
 * its content, so the grid's rows line up instead of going ragged. The thumbnail is already a fixed
 * `aspect-video` box; the title reserves a fixed two-line height (`line-clamp-2` + `min-h-10`, matching
 * two lines of `text-sm`) whether the name is one line or two; and the metadata block below always
 * reserves the same two-row height (`min-h-[34px]`) whether it's showing two populated rows, a single
 * loading/error line, or (when the probe found no video stream) one empty + one populated row — so no
 * card's natural content height ever differs from another's. On top of that, `h-full` chains from this
 * component's own wrapper through the `Button` to the `HudPanel` (below), so the visible panel border
 * also fills whatever the CSS Grid row happens to be — belt-and-suspenders on top of the uniform content,
 * not a replacement for it (a `grid-auto-rows`/stretch trick alone can't equalize rows that hold
 * genuinely different content heights; making the content heights equal is what actually does that).
 *
 * **Click target vs. overlays — the stacking design (owner feedback, 3rd iteration).** The whole card is
 * clickable, but the checkbox and quality badge must sit *inside the thumbnail's own corners* so they can
 * never overlap the card's neon border — anchoring them to the card wrapper (and nudging pixels against
 * the panel's implicit padding) is exactly what kept putting them on the edge. A native checkbox may not
 * be nested inside a `<button>` (invalid HTML — the parser splits the button), so the geometry is solved
 * with pointer-events instead of nesting:
 *   - a transparent full-card `<button>` (`absolute inset-0`) is the click target, painted *behind* the
 *     panel (`z-0`);
 *   - the `HudPanel` paints on top (`relative z-[1]`) but is `pointer-events-none`, so a click anywhere
 *     on it falls straight through to the button behind — the card still clicks as one surface;
 *   - the `Checkbox` re-enables `pointer-events-auto` on itself, so it (and only it) catches its own
 *     clicks while everything around it passes through. It lives *inside* the thumbnail's `relative` box
 *     at `top-2 left-2`, so it is always on the preview image, never on a card border.
 * The button doesn't decide what a click means — it reports the path plus the held modifier keys to
 * `onSelect`, and the Library view (which owns the bulk-selection store and the grid order Shift-click
 * needs) interprets them. Because the panel is `pointer-events-none`, the panel's own hover glow is driven
 * from the wrapper (`group-hover:`), not `hover:` — the wrapper still receives hover via the button.
 *
 * The `QualityBadge` mirrors the checkbox at the thumbnail's top-**right** corner (`top-2 right-2`), same
 * inset, so the two overlays read as one consistent system; it carries no interaction of its own.
 *
 * **Checkbox reveal** (P2.3): it stays hidden (opacity, never `display`/`visibility`, so it remains
 * keyboard-reachable) until the card is hovered or focused-within, is itself checked, or `anySelected` is
 * true — so an idle grid isn't a column of boxes, but the control is one hover/tab away, and a checked box
 * never disappears.
 */
export function VideoCard({
  file,
  onSelect,
  onToggleSelect,
  selected = false,
  anySelected = false,
}: VideoCardProps) {
  const t = useT();
  const thumb = useThumbnail(file.path);
  const probe = useProbe(file.path);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    onSelect(file.path, { ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey });
  };

  const checkboxVisible = selected || anySelected;

  return (
    <div className="group relative h-full">
      {/* Click target: the HUD `Button` primitive (a raw `<button>` is banned in a view, ADR-APP-026) in
          its borderless `ghost` variant, painted behind the panel (`z-0`) and filling the card
          (`inset-0`). The `pointer-events-none` panel above lets every click that isn't the checkbox fall
          through to it, so the whole card acts as one button without the checkbox having to be a
          descendant of it (invalid HTML — see the doc comment). */}
      <Button
        variant="ghost"
        onClick={handleClick}
        className="absolute inset-0 z-0 h-full w-full p-0"
        aria-label={file.name}
        aria-pressed={selected}
      />
      <HudPanel
        accent={selected ? "green" : "cyan"}
        className={`group-hover:neon-glow-cyan pointer-events-none relative z-[1] h-full overflow-hidden transition-shadow ${selected ? "neon-glow-green" : ""}`}
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

            {/* Overlays live INSIDE the thumbnail's own relative box (`top-2 left-2` / `top-2 right-2` =
                8px in), so they are always on the preview image and can never touch a card border — the
                fix for the recurring "checkbox overhangs the edge" report.

                The checkbox sits in an absolutely-positioned wrapper `div`, NOT positioned directly: its
                own `<label>` carries `.hud-btn { position: relative }`, which beats a Tailwind `absolute`
                on the same element (custom class vs utility — no reliable last-wins), so positioning it
                directly left it `relative`, in-flow, and it displaced the image instead of overlaying it.
                Putting the `absolute`/reveal/`pointer-events-auto` on a plain wrapper div keeps the two
                concerns from colliding — same wrap-for-layout pattern the player's sliders use. */}
            <div
              className={`pointer-events-auto absolute top-2 left-2 z-10 transition-opacity duration-150 ${
                checkboxVisible
                  ? "opacity-100"
                  : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              }`}
            >
              <Checkbox
                checked={selected}
                onChange={() => onToggleSelect(file.path)}
                label={t("library.card.select", { name: file.name })}
                size="sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {probe.data ? (
              <QualityBadge tier={probe.data.quality} className="absolute top-2 right-2 z-10" />
            ) : null}
          </div>

          <span className="text-fg line-clamp-2 min-h-10 text-sm">{file.name}</span>

          {/* Metadata (design review, owner feedback): the scannable facts are colour-coded HUD badges
              — the resolution tier tinted the SAME accent as the corner `QualityBadge` (one tier → one
              colour, ADR-CORE-005) and the codec in cyan — with the exact numbers demoted to a dim
              secondary line. A fixed `min-h` (badge row + secondary row, or the single loading/error
              line) keeps every card the same height (uniform card size, above). */}
          <div className="flex min-h-[42px] flex-col justify-center gap-1.5">
            {probe.data ? (
              <>
                {/* Always rendered (even audio-only) so the secondary row never shifts up and changes the
                    block's height across cards. */}
                <div className="flex h-[18px] flex-wrap items-center gap-1">
                  {probe.data.video ? (
                    <>
                      <Badge accent={accentForTier(probe.data.quality)}>
                        {resolutionLabel(probe.data.video.width, probe.data.video.height)}
                      </Badge>
                      <Badge accent="cyan">{probe.data.video.codec.toUpperCase()}</Badge>
                    </>
                  ) : (
                    <Badge accent="gold">{t("library.card.audioOnly")}</Badge>
                  )}
                </div>
                <div className="text-dim flex h-4 items-center gap-2 font-mono text-[11px] leading-4">
                  {probe.data.video ? (
                    <span>
                      {probe.data.video.width}×{probe.data.video.height}
                    </span>
                  ) : null}
                  <span className="text-gold flex items-center gap-1">
                    <Clock size={10} strokeWidth={2} aria-hidden />
                    {formatDuration(probe.data.duration_secs ?? 0)}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive size={10} strokeWidth={2} aria-hidden />
                    {formatBytes(file.size_bytes)}
                  </span>
                </div>
              </>
            ) : probe.isError ? (
              <span className="flex items-start gap-1 font-mono text-[11px] leading-4">
                <AlertTriangle size={11} className="text-danger mt-0.5 shrink-0" aria-hidden />
                {/* Clamped to 2 lines: the error message is arbitrary backend text and could otherwise
                    grow past the block's reserved min-height. */}
                <span className="text-danger line-clamp-2">
                  {t("library.card.probeError", { message: errorMessage(probe.error) })}
                </span>
              </span>
            ) : (
              <span className="text-dim flex h-4 items-center gap-1.5 font-mono text-[11px] leading-4">
                <Loader2 size={11} strokeWidth={2} className="animate-spin" aria-hidden />
                {t("common.loading")}
              </span>
            )}
          </div>
        </div>
      </HudPanel>
    </div>
  );
}
