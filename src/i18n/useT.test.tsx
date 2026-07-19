import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useT } from "./useT";
import { settingsDto } from "../test/settings";

vi.mock("../api/commands", () => ({
  api: { getSettings: vi.fn() },
}));

import { api } from "../api/commands";

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function renderT() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useT(), { wrapper: makeWrapper(qc) });
}

describe("useT", () => {
  beforeEach(() => {
    vi.mocked(api.getSettings).mockReset();
  });

  it("defaults to German while the settings query is still loading", () => {
    vi.mocked(api.getSettings).mockReturnValue(new Promise(() => {}));
    const { result } = renderT();
    expect(result.current("about.title")).toBe("Über");
  });

  it("translates in the persisted language once settings resolve", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto({ language: "en" }));
    const { result } = renderT();
    await waitFor(() => expect(result.current("about.title")).toBe("About"));
  });

  it("uses German when the persisted language is de", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto({ language: "de" }));
    const { result } = renderT();
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());
    expect(result.current("about.title")).toBe("Über");
  });

  it("normalises an unrecognised persisted language to German", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto({ language: "fr" }));
    const { result } = renderT();
    await waitFor(() => expect(api.getSettings).toHaveBeenCalled());
    expect(result.current("about.title")).toBe("Über");
  });

  it("interpolates params through the translated string", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto({ language: "en" }));
    const { result } = renderT();
    await waitFor(() =>
      expect(result.current("statusbar.aboutTooltip", { name: "Vidforge" })).toBe("About Vidforge"),
    );
  });
});
