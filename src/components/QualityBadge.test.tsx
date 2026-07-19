import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QualityBadge } from "./QualityBadge";
import { settingsDto } from "../test/settings";
import type { QualityTier } from "../bindings/QualityTier";

vi.mock("../api/commands", () => ({
  api: { getSettings: vi.fn() },
}));

import { api } from "../api/commands";

function renderBadge(tier: QualityTier) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QualityBadge tier={tier} />
    </QueryClientProvider>,
  );
}

describe("QualityBadge", () => {
  beforeEach(() => {
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
  });

  it.each([
    ["Excellent", "green", "Exzellent"],
    ["Good", "green", "Gut"],
    ["Fair", "gold", "Mittel"],
    ["Low", "gold", "Niedrig"],
    ["Poor", "danger", "Schlecht"],
  ] as const)("maps %s to the %s accent and its German label", async (tier, accent, label) => {
    renderBadge(tier);
    const badge = await screen.findByText(label);
    expect(badge.className).toContain(`hud-accent-${accent}`);
  });

  it("shows the German label by default", async () => {
    renderBadge("Excellent");
    expect(await screen.findByText("Exzellent")).toBeInTheDocument();
  });

  it("shows the localized English label", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto({ language: "en" }));
    renderBadge("Poor");
    expect(await screen.findByText("Poor")).toBeInTheDocument();
  });
});
