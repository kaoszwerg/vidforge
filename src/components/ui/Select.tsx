import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { hudAccentTextClass, hudButtonClass, type HudAccent } from "./hudButton";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  /** Currently selected value. Must match one of `options[].value`. */
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** HUD accent colour (ADR-APP-020). Defaults to cyan. */
  accent?: HudAccent;
  /** Visible label rendered above the control and linked via `aria-labelledby`. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * HUD dropdown select (ADR-APP-026): the replacement for the native `<select>`, whose OS-drawn popup
 * is a visual break in the HUD. A chamfered trigger button (built on `hudButtonClass`, matching
 * `Button`/`IconButton`) opens a portal-rendered listbox, mirroring the `Tooltip` /
 * `HudPanel`'s info-popover pattern: fixed-positioned from the trigger's own rect, closed by an
 * outside click or Escape.
 *
 * Keyboard focus never leaves the trigger — this is the ARIA 1.2 "collapsible listbox" pattern, the
 * same one a native `<select>` implements. Up/Down move a highlighted option tracked via
 * `aria-activedescendant`; Enter/Space commit it; Escape cancels without changing the value.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  accent = "cyan",
  label,
  disabled = false,
  className = "",
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;
  const optionId = (i: number) => `${baseId}-option-${i}`;

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options.at(selectedIndex);

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
    setActiveIndex(selectedIndex);
    setOpen(true);
  };
  const closeMenu = () => setOpen(false);
  const commit = (index: number) => {
    const opt = options.at(index);
    if (opt) onChange(opt.value);
    closeMenu();
    triggerRef.current?.focus();
  };

  // Escape closes from anywhere in the document, matching Tooltip/HudPanel's popover behaviour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;
      default:
        break;
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label ? (
        <span
          id={labelId}
          className="hud-label"
          style={{ "--hud-label-size": "0.7rem" } as CSSProperties}
        >
          {label}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={label ? labelId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className={`${hudButtonClass({ accent })} flex min-w-[8rem] items-center justify-between gap-2 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[70]" role="presentation" onClick={closeMenu} />
              <ul
                id={listboxId}
                role="listbox"
                aria-labelledby={label ? labelId : undefined}
                className={`hud-popover hud-clip-sm hud-accent-${accent} fixed z-[71] max-h-60 overflow-auto py-1 text-xs`}
                style={{ top: pos.top, left: pos.left, width: pos.width }}
              >
                {options.map((opt, i) => (
                  <li
                    key={opt.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={opt.value === value}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(i)}
                    // DOM focus never moves into the list (see the component doc comment) — the
                    // trigger's onKeyDown drives Up/Down/Enter/Escape. This handler is a defensive
                    // second path only, satisfying the a11y rule that a click target also answers
                    // the keyboard, in case an option is ever reached by assistive-tech focus.
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        commit(i);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 ${
                      i === activeIndex ? `bg-elevated ${hudAccentTextClass(accent)}` : "text-fg"
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.value === value ? (
                      <Check size={12} strokeWidth={2.5} className="shrink-0" />
                    ) : null}
                  </li>
                ))}
              </ul>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
