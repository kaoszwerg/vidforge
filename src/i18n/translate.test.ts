import { describe, it, expect, vi } from "vitest";

// A small, controlled fixture — not the real catalogue — so the fallback chain can be exercised
// deterministically: `en` deliberately omits a key `de` has, and neither table has a third.
vi.mock("./messages", () => ({
  de: { "settings.language": "Hallo, {name}", "about.title": "Nur Deutsch" },
  en: { "settings.language": "Hello, {name}" },
}));

import { translate } from "./translate";

describe("translate", () => {
  it("looks up the key in the requested language", () => {
    expect(translate("en", "settings.language", { name: "Ada" })).toBe("Hello, Ada");
    expect(translate("de", "settings.language", { name: "Ada" })).toBe("Hallo, Ada");
  });

  it("falls back to German when the requested language's table is missing the key", () => {
    expect(translate("en", "about.title")).toBe("Nur Deutsch");
  });

  it("falls back to the raw key when neither table has it", () => {
    expect(translate("en", "nav.home")).toBe("nav.home");
    expect(translate("de", "nav.home")).toBe("nav.home");
  });

  it("interpolates every {param} occurrence", () => {
    expect(translate("en", "settings.language", { name: "Grace" })).toBe("Hello, Grace");
  });

  it("leaves an unmatched placeholder as literal text instead of dropping it", () => {
    expect(translate("en", "settings.language", {})).toBe("Hello, {name}");
  });

  it("returns the raw string unchanged when no params are given", () => {
    expect(translate("de", "about.title")).toBe("Nur Deutsch");
  });
});
