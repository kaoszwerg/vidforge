import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { Select, type SelectOption } from "./Select";

const OPTIONS: SelectOption<"de" | "en">[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

function Controlled({ onChange }: { onChange?: (v: "de" | "en") => void }) {
  const [value, setValue] = useState<"de" | "en">("de");
  return (
    <Select
      label="Language"
      value={value}
      options={OPTIONS}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("Select", () => {
  it("shows the selected option's label on the closed trigger", () => {
    render(<Select label="Language" value="de" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Deutsch");
  });

  it("is closed until the trigger is clicked, then renders every option", () => {
    render(<Select label="Language" value="de" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));

    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Deutsch" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
  });

  it("marks the current value as the selected option", () => {
    render(<Select label="Language" value="en" options={OPTIONS} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    expect(screen.getByRole("option", { name: "English" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("option", { name: "Deutsch" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("calls onChange and closes when an option is clicked", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));

    expect(onChange).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English");
  });

  it("closes on Escape without changing the value", () => {
    const onChange = vi.fn();
    render(<Select label="Language" value="de" options={OPTIONS} onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on an outside click", () => {
    render(
      <div>
        <Select label="Language" value="de" options={OPTIONS} onChange={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens and commits via the keyboard (ArrowDown then Enter)", () => {
    const onChange = vi.fn();
    render(<Select label="Language" value="de" options={OPTIONS} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Language" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("en");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not open when disabled", () => {
    render(<Select label="Language" value="de" options={OPTIONS} onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("combobox", { name: "Language" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("links the trigger to the listbox via aria-controls/aria-expanded", () => {
    render(<Select label="Language" value="de" options={OPTIONS} onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: "Language" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
  });
});
