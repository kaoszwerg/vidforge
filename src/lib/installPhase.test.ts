import { describe, it, expect } from "vitest";
import { installPhaseLabelKey } from "./installPhase";

describe("installPhaseLabelKey", () => {
  it("maps every known phase to its label key", () => {
    expect(installPhaseLabelKey("download")).toBe("install.phase.download");
    expect(installPhaseLabelKey("verify")).toBe("install.phase.verify");
    expect(installPhaseLabelKey("extract")).toBe("install.phase.extract");
    expect(installPhaseLabelKey("done")).toBe("install.phase.done");
  });

  it("falls back to the generic 'installing' label for an unrecognised phase", () => {
    expect(installPhaseLabelKey("some-future-phase")).toBe("install.phase.install");
  });
});
