export interface MetaRowProps {
  /** The label (left column). */
  k: string;
  /** The value (right column). */
  v: string;
}

/** One label/value row inside a metadata `<dl>` (ADR-CORE-005) — the two-column layout every metadata
 * panel in the app uses (HomeView's build info, DetailView's technical metadata): a caller wraps a
 * list of these in its own `<dl className="grid grid-cols-2 …">`. Not interactive, so it is not gated
 * by ADR-APP-026 the way a control is — it lives in `src/components/ui` for co-location with the rest
 * of the shared HUD surface, not because it renders a native element. */
export function MetaRow({ k, v }: MetaRowProps) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}
