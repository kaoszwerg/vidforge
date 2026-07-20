import type { InputHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { hudButtonClass, type HudAccent } from "./hudButton";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "title" | "onChange" | "checked"
> & {
  /** Current checked state — this is a controlled component, like every other HUD input primitive. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name — a checkbox with no visible text of its own needs one (e.g. `"Select {name}"`). */
  label: string;
  /** HUD accent colour (ADR-APP-020) for the checked fill. Defaults to green, matching the selection
   * accent `VideoCard`/`HudPanel` already use for "selected" (ADR-CORE-005: one accent, one meaning). */
  accent?: HudAccent;
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
  disabled = false,
  className = "",
  ...rest
}: CheckboxProps) {
  return (
    <label
      className={`${hudButtonClass({ accent, active: checked })} focus-within:ring-cyan/60 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center focus-within:ring-1 ${
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
      {checked ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
    </label>
  );
}
