export interface MetaRowProps {
  /** The label (left column). */
  k: string;
  /** The value (right column). */
  v: string;
}

/** One label/value row inside a metadata `<dl>` (ADR-CORE-005) — the two-column layout every metadata
 * panel in the app uses (HomeView's build info, DetailView's technical metadata): a caller wraps a
 * list of these in its own `<dl className="grid grid-cols-…">`. The row is its own
 * `grid-cols-[minmax(0,auto)_1fr]` so the value sits immediately after the label (an associated pair,
 * not two ends of a justified row) and truncates instead of wrapping or stretching the row when the
 * rail it lives in is narrow. Not interactive, so it is not gated by ADR-APP-026 the way a control is —
 * it lives in `src/components/ui` for co-location with the rest of the shared HUD surface, not because
 * it renders a native element. */
export function MetaRow({ k, v }: MetaRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,auto)_1fr] items-baseline gap-x-3">
      <dt className="text-dim">{k}</dt>
      <dd className="text-fg min-w-0 truncate font-mono">{v}</dd>
    </div>
  );
}
