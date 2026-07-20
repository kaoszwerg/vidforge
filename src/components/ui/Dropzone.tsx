import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";
import { hudAccentTextClass, type HudAccent } from "./hudButton";
import { useT } from "../../i18n";

export interface DropzoneProps {
  /** Called with the absolute path of the folder the user dropped. Only the first dropped path is
   * used — Vidforge is folder-scoped (ADR-PROJ-001), one folder at a time. */
  onFolderDropped: (path: string) => void;
  /** Called when the user activates the Browse affordance (wire it to `api.pickFolder()`). */
  onBrowse: () => void;
  /** HUD accent colour (ADR-APP-020). Defaults to cyan. */
  accent?: HudAccent;
  className?: string;
  /** Custom label content. Defaults to a short instructional line. */
  children?: ReactNode;
  /** Collapse the big drop target into a single-row bar (current folder + a small "change folder"
   * button) once a folder is loaded and its grid/empty/scan-result state is already showing below —
   * the large `p-8` target only earns its space before that, on the first-run/empty state. The
   * window-wide drag-drop listener (below) stays subscribed either way, so dropping a new folder
   * anywhere in the window keeps working in both modes. */
  compact?: boolean;
}

/**
 * HUD drop target for a single folder (ADR-PROJ-001). Listens to the Tauri webview's native OS
 * drag-drop (`getCurrentWebview().onDragDropEvent`) rather than the browser's HTML5
 * `dragover`/`drop` events: Tauri's webview handles drag-drop at the OS level, and only this event
 * carries real filesystem paths. Note this event is window-scoped, not scoped to this element — while
 * a `Dropzone` is mounted, the whole window is a drop target, and this box is where that is
 * communicated visually.
 *
 * Only the first dropped path is used. Dropping a file (not a folder) is handed to
 * `onFolderDropped` unchanged and rejected downstream by `scan_folder` (the Rust side validates
 * `is_dir()`), so the error surfaces through the caller's own scan-error state rather than being
 * silently swallowed here.
 *
 * A `Browse` HUD button (the OS-native folder dialog — the one documented native-surface exception,
 * ADR-APP-026 §3 / ADR-PROJ-001) is offered alongside the drop target via `onBrowse`.
 *
 * `compact` swaps the large `p-8` invitation for a slim single-row bar once there is already content
 * below it to invite attention to — the same `onFolderDropped`/`onBrowse` wiring, just a smaller visual
 * footprint (LibraryView's grid/empty/scan-error states).
 */
export function Dropzone({
  onFolderDropped,
  onBrowse,
  accent = "cyan",
  className = "",
  children,
  compact = false,
}: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  // The drag-drop listener is registered once (empty deps below) so it survives re-renders without
  // resubscribing; this ref keeps it reading the latest callback instead of a stale closure. Updated
  // in its own effect, never during render (refs are read/write only outside of render).
  const onFolderDroppedRef = useRef(onFolderDropped);
  useEffect(() => {
    onFolderDroppedRef.current = onFolderDropped;
  }, [onFolderDropped]);
  const t = useT();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        switch (event.payload.type) {
          case "enter":
          case "over":
            setDragActive(true);
            break;
          case "drop":
            setDragActive(false);
            if (event.payload.paths.length > 0) {
              onFolderDroppedRef.current(event.payload.paths[0]);
            }
            break;
          case "leave":
            setDragActive(false);
            break;
        }
      })
      .then((fn) => {
        // The effect may have been cleaned up (component unmounted) before the async subscription
        // resolved; unlisten immediately instead of leaking a handler with nothing left to update.
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  if (compact) {
    return (
      <div
        className={`hud-panel hud-clip-sm hud-accent-${accent} transition-shadow ${dragActive ? `neon-glow-${accent}` : ""} ${className}`.trim()}
      >
        <div className="relative z-[1] flex items-center gap-3 px-3 py-2">
          <FolderOpen
            size={16}
            strokeWidth={1.5}
            className={`shrink-0 ${hudAccentTextClass(accent)}`}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {children ?? <p className="text-dim text-sm">{t("library.dropzone.label")}</p>}
          </div>
          <Button
            accent={accent}
            variant="ghost"
            onClick={onBrowse}
            className="shrink-0 px-2 py-1 text-xs"
          >
            {t("library.dropzone.changeFolder")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`hud-panel hud-clip hud-accent-${accent} transition-shadow ${dragActive ? `neon-glow-${accent}` : ""} ${className}`.trim()}
    >
      <div className="relative z-[1] flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FolderOpen
          size={32}
          strokeWidth={1.5}
          className={hudAccentTextClass(accent)}
          aria-hidden
        />
        {children ?? <p className="text-dim text-sm">{t("library.dropzone.label")}</p>}
        <Button accent={accent} onClick={onBrowse} className="px-4 py-1.5 text-xs">
          {t("library.dropzone.browse")}
        </Button>
      </div>
    </div>
  );
}
