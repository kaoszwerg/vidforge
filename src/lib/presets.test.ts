import { describe, it, expect } from "vitest";
import { presetLabelKey, presetDescriptionKey, isConvertiblePreset } from "./presets";

describe("presetLabelKey", () => {
  it.each([
    ["universal", "preset.universal"],
    ["efficient", "preset.efficient"],
    ["archive", "preset.archive"],
    ["repair", "preset.repair"],
    ["custom", "preset.custom"],
  ] as const)("maps %s to %s", (id, key) => {
    expect(presetLabelKey(id)).toBe(key);
  });

  it("falls back to the custom label for an unrecognised id", () => {
    expect(presetLabelKey("future-preset")).toBe("preset.custom");
  });
});

describe("presetDescriptionKey", () => {
  it.each([
    ["universal", "preset.universal.desc"],
    ["efficient", "preset.efficient.desc"],
    ["archive", "preset.archive.desc"],
    ["repair", "preset.repair.desc"],
    ["custom", "preset.custom.desc"],
  ] as const)("maps %s to %s", (id, key) => {
    expect(presetDescriptionKey(id)).toBe(key);
  });

  it("falls back to the custom description for an unrecognised id", () => {
    expect(presetDescriptionKey("future-preset")).toBe("preset.custom.desc");
  });
});

describe("isConvertiblePreset", () => {
  it.each(["universal", "efficient", "archive", "future-preset"])("accepts %s", (id) => {
    expect(isConvertiblePreset(id)).toBe(true);
  });

  it.each(["repair", "custom"])("rejects %s", (id) => {
    expect(isConvertiblePreset(id)).toBe(false);
  });
});
