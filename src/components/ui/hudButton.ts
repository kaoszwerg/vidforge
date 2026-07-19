/** The five HUD accent colours (ADR-APP-020). One source for every interactive HUD primitive, so a
 * button, panel and popover that call themselves "cyan" mean the exact same token. */
export type HudAccent = "cyan" | "green" | "gold" | "purple" | "danger";

/** Visual surface of a HUD control: the chamfered neon `solid` button, or a borderless `ghost`
 * text/icon control that only shifts colour on hover. */
export interface HudButtonStyle {
  accent?: HudAccent;
  active?: boolean;
  variant?: "solid" | "ghost";
}

/** Shared `disabled:` treatment for every HUD button surface — one place so a `Convert`/`Cancel`
 * control disabled while a mutation is in flight (DetailView, LibraryView's bulk bar, the status-bar
 * job list) looks disabled without every call site repeating the same two Tailwind utilities
 * (ADR-CORE-005). No visual effect while the control is enabled. */
const DISABLED_CLASSES = "disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Tailwind class string for a HUD button surface (ADR-APP-020, ADR-APP-026). Centralised so `Button`,
 * `IconButton` and any future control render an identical surface instead of each re-deriving the
 * `.hud-btn` / `.hud-clip-sm` / accent combination.
 *
 * - `solid` (default): chamfered neon button; `active` locks it into the filled hover state.
 * - `ghost`: no chamfer or fill — a text/icon control that brightens to cyan on hover, for status
 *   strips and inline actions. Layout/colour-at-rest classes come from the caller's `className`.
 */
export function hudButtonClass({
  accent = "cyan",
  active = false,
  variant = "solid",
}: HudButtonStyle = {}): string {
  if (variant === "ghost") {
    return `transition-colors hover:text-cyan ${DISABLED_CLASSES}${active ? " text-cyan" : ""}`;
  }
  return `hud-clip-sm hud-btn hud-accent-${accent} ${DISABLED_CLASSES}${active ? " hud-btn-active" : ""}`;
}

// `Map` rather than plain-object bracket access: the accent is chosen at runtime, and `obj[accent]`
// is exactly the dynamic-key indexing `security/detect-object-injection` flags (see the same
// reasoning in i18n/translate.ts).
const ACCENT_TEXT = new Map<HudAccent, string>([
  ["cyan", "text-cyan"],
  ["green", "text-green"],
  ["gold", "text-gold"],
  ["purple", "text-purple"],
  ["danger", "text-danger"],
]);

/** Tailwind text-colour class for a HUD accent (ADR-APP-020) — the single source so `Select`, `Badge`
 * and any future accent-coloured label agree on which token means "gold" (ADR-CORE-005). */
export function hudAccentTextClass(accent: HudAccent): string {
  return ACCENT_TEXT.get(accent) ?? "text-cyan";
}

const ACCENT_BG = new Map<HudAccent, string>([
  ["cyan", "bg-cyan"],
  ["green", "bg-green"],
  ["gold", "bg-gold"],
  ["purple", "bg-purple"],
  ["danger", "bg-danger"],
]);

/** Tailwind background-colour class for a HUD accent (ADR-APP-020) — the fill counterpart of
 * `hudAccentTextClass`, used by `ProgressBar` and anything else that paints a solid accent surface
 * rather than colouring text (ADR-CORE-005). */
export function hudAccentBgClass(accent: HudAccent): string {
  return ACCENT_BG.get(accent) ?? "bg-cyan";
}
