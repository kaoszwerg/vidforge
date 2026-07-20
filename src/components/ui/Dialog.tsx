import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useT } from "../../i18n";

export interface DialogProps {
  /** Whether the dialog is shown. Rendered through a portal only while `true`. */
  open: boolean;
  /** Called on any dismissal — the close button, a backdrop click, or Escape. */
  onClose: () => void;
  /** Accessible heading, shown in the header and wired via `aria-labelledby`. Named `heading`, not
   * `title`, so it is neither confused with nor linted as the native `title` tooltip (ADR-APP-026). */
  heading: string;
  /** The dialog body. Owns its own layout (the folder browser lays out its own columns inside). */
  children: ReactNode;
  /** Optional footer row (actions), pinned below the scrollable body. */
  footer?: ReactNode;
  /** Size/shape classes for the panel. Defaults to a large centred dialog that fits small windows. */
  panelClassName?: string;
}

/**
 * HUD modal dialog (ADR-APP-026): the design-system replacement for a browser/OS dialog. A chamfered
 * `hud-panel` centred over a solid scrim (no `backdrop-filter` — weak on Linux WebKitGTK, rule:ui-design),
 * rendered through a portal so a parent's `clip-path`/overflow can't crop it. Dismissed by the close
 * button, a scrim click or Escape.
 *
 * Accessibility: `role="dialog"` + `aria-modal` + `aria-labelledby` the title; focus moves into the panel
 * on open and is restored to the trigger on close; Tab is trapped inside the panel so keyboard focus
 * can't wander to the (inert) page behind it.
 */
export function Dialog({ open, onClose, heading, children, footer, panelClassName }: DialogProps) {
  const t = useT();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // One window-level keydown handler for the whole modal: Escape closes, and Tab is trapped inside the
  // panel (the page behind a modal is inert, so focus must cycle within it). Kept at the window rather
  // than as an `onKeyDown` on the panel, because a `role="dialog"` element is non-interactive and
  // jsx-a11y (rightly) rejects a keyboard listener on it — and a window listener also catches Tab no
  // matter where focus currently sits.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the panel on open; restore it to whatever was focused (the trigger) on close.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => restoreFocusRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      {/* Scrim as a real, labelled button so the click-to-close is keyboard/AT-legible and passes
          jsx-a11y — a bare div with a handler does not. `tabIndex={-1}` keeps it out of the tab cycle
          (Escape and the header close button are the keyboard paths); a `click` only fires here when it
          both starts and ends on the scrim, so a drag out of the panel never closes it. */}
      <button
        type="button"
        aria-label={t("common.close")}
        tabIndex={-1}
        onClick={onClose}
        className="bg-deep/80 absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`hud-panel hud-clip hud-accent-cyan relative z-[1] flex flex-col overflow-hidden outline-none ${
          panelClassName ?? "h-[600px] max-h-[85vh] w-[920px] max-w-[92vw]"
        }`}
      >
        <div className="relative z-[1] flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h2 id={titleId} className="hud-label text-glow-cyan">
            {heading}
          </h2>
          <IconButton
            label={t("common.close")}
            variant="ghost"
            tooltip={null}
            onClick={onClose}
            className="h-7 w-7 shrink-0"
          >
            <X size={15} strokeWidth={2} />
          </IconButton>
        </div>
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col px-4">{children}</div>
        {footer ? (
          <div className="border-elevated relative z-[1] mt-3 flex items-center justify-between gap-3 border-t px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
