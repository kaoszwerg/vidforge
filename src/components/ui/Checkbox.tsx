import type { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { hudButtonClass, type HudAccent } from "./hudButton";

/** Box size: `"md"` (24px, default) is the standalone checkbox; `"sm"` (20px) is for a tight overlay
 * corner — e.g. `VideoCard`'s thumbnail badge, where the smaller box gives more clearance from the
 * thumbnail's own chamfer. Not exported: a caller picks it via `CheckboxProps.size` (whose own type
 * this feeds) rather than naming this alias directly — keeps knip's unused-export check clean. */
type CheckboxSize = "md" | "sm";

// Literal per-size strings (not built via `${size}` interpolation) so Tailwind's static scanner can see
// and generate every class — same reasoning as the accent `Map`s in `hudButton.ts`.
const SIZE_CLASSES = new Map<CheckboxSize, string>([
  ["md", "h-6 w-6"],
  ["sm", "h-5 w-5"],
]);
const CHECK_ICON_SIZE = new Map<CheckboxSize, number>([
  ["md", 14],
  ["sm", 12],
]);

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "title" | "onChange" | "checked" | "size"
> & {
  /** Current checked state — this is a controlled component, like every other HUD input primitive. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — a checkbox with no visible text of its own needs one (e.g. `"Select {name}"`). */
  label: string;
  /** HUD accent colour (ADR-APP-020) for the checked fill. Defaults to green, matching the selection
   * accent `VideoCard`/`HudPanel` already use for "selected" (ADR-CORE-005: one accent, one meaning). */
  accent?: HudAccent;
  /** Box size (see `CheckboxSize`). Defaults to `"md"`. */
  size?: CheckboxSize;
  disabled?: boolean;
  className?: string;
};

/**
 * HUD checkbox (ADR-APP-026): a native `<input type="checkbox">` — banned everywhere outside
 * `src/components/ui`, legitimately built upon here — visually hidden (`sr-only`, so it keeps focus,
 * keyboard (Space) and screen-reader behaviour) underneath a chamfered box built from the same
 * `hudButtonClass` surface every other HUD control uses: unchecked mirrors the button's resting state,
 * checked reuses the `active` (solid-filled) state with a check glyph on top, so a checkbox and a toggled
 * `Button`/`IconButton` read as the same "on" state everywhere (ADR-CORE-005).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  accent = "green",
  size = "md",
  disabled = false,
  className = "",
  ...rest
}: CheckboxProps) {
  const boxSize = SIZE_CLASSES.get(size) ?? SIZE_CLASSES.get("md");
  const iconSize = CHECK_ICON_SIZE.get(size) ?? CHECK_ICON_SIZE.get("md");
  return (
    <label
      /* `hud-clip-xs` (symmetric chamfer) overrides the asymmetric `hud-clip-sm` that `hudButtonClass`
         brings, so a small checkbox reads as an even square rather than a lopsided one (owner feedback). */
      className={`${hudButtonClass({ accent, active: checked })} hud-clip-xs focus-within:ring-cyan/60 flex ${boxSize} shrink-0 cursor-pointer items-center justify-center focus-within:ring-1 ${
        disabled ? "cursor-not-allowed opacity-40" : ""
      } ${className}`.trim()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        {...rest}
      />
      {checked ? <Check size={iconSize} strokeWidth={3} aria-hidden /> : null}
    </label>
  );
}
