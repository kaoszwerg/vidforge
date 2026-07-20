/** The five HUD accent colours (ADR-APP-020). One source for every interactive HUD primitive, so a
 * button, panel and popover that call themselves "cyan" mean the exact same token. */
export type HudAccent = "cyan" | "green" | "gold" | "purple" | "danger";

/** Visual surface of a HUD control: the chamfered neon `solid` button, or a borderless `ghost`
 * text/icon control tinted at a faint accent at rest that brightens on hover (P2.8). */
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

// `ghost`'s resting + hover colour per accent (P2.8, design review): a faint accent tint at rest so an
// actionable ghost control (StatusBar's About/scroll-to-top, a card's whole click target, a repair/quit
// action) reads as clickable *before* hover, instead of looking like static text — brightening to the
// full accent on hover, same as it always did. Every entry is a fully literal class string (not built
// via `${accent}` interpolation) so Tailwind's static scanner can see and generate it — the same reason
// `ACCENT_TEXT`/`ACCENT_BG` below are a `Map` rather than template-built strings.
const GHOST_ACCENT_CLASSES = new Map<HudAccent, string>([
  ["cyan", "text-cyan/60 hover:text-cyan"],
  ["green", "text-green/60 hover:text-green"],
  ["gold", "text-gold/60 hover:text-gold"],
  ["purple", "text-purple/60 hover:text-purple"],
  ["danger", "text-danger/60 hover:text-danger"],
]);

/**
 * Tailwind class string for a HUD button surface (ADR-APP-020, ADR-APP-026). Centralised so `Button`,
 * `IconButton` and any future control render an identical surface instead of each re-deriving the
 * `.hud-btn` / `.hud-clip-sm` / accent combination.
 *
 * - `solid` (default): chamfered neon button; `active` locks it into the filled hover state.
 * - `ghost`: no chamfer or fill — a text/icon control tinted at a faint 60% of its accent at rest,
 *   brightening to the full accent on hover or when `active` (P2.8 — reads as clickable *before* hover,
 *   instead of looking like static text), for status strips and inline actions. A caller that needs a
 *   different resting colour passes its own `text-*` class in `className` — pick the right `accent`
 *   instead of fighting this one with an override, since two same-specificity Tailwind utilities for the
 *   same property don't have a reliable "last one wins" order.
 */
export function hudButtonClass({
  accent = "cyan",
  active = false,
  variant = "solid",
}: HudButtonStyle = {}): string {
  if (variant === "ghost") {
    const colors = GHOST_ACCENT_CLASSES.get(accent) ?? GHOST_ACCENT_CLASSES.get("cyan");
    return `transition-colors ${colors} ${DISABLED_CLASSES}${active ? ` ${hudAccentTextClass(accent)}` : ""}`;
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
