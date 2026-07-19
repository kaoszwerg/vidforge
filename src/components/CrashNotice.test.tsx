import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CrashNotice } from "./CrashNotice";
import { settingsDto } from "../test/settings";

vi.mock("../api/commands", () => ({
  api: {
    pendingCrash: vi.fn(),
    getSettings: vi.fn(),
  },
}));

import { api } from "../api/commands";

function renderNotice() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CrashNotice />
    </QueryClientProvider>,
  );
}

describe("CrashNotice", () => {
  beforeEach(() => {
    vi.mocked(api.pendingCrash).mockReset();
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
  });

  it("renders nothing when there is no pending crash report", async () => {
    vi.mocked(api.pendingCrash).mockResolvedValue(null);
    renderNotice();

    await waitFor(() => expect(api.pendingCrash).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the localised notice with the report path when the previous run crashed", async () => {
    vi.mocked(api.pendingCrash).mockResolvedValue("/data/crashes/crash-1.log");
    renderNotice();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Die letzte Sitzung wurde durch einen Absturz beendet."),
    ).toBeInTheDocument();
    expect(screen.getByText("/data/crashes/crash-1.log")).toBeInTheDocument();
  });

  it("dismisses the notice without querying again", async () => {
    vi.mocked(api.pendingCrash).mockResolvedValue("/data/crashes/crash-1.log");
    renderNotice();

    const dismiss = await screen.findByRole("button", { name: "Verwerfen" });
    fireEvent.click(dismiss);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.pendingCrash).toHaveBeenCalledTimes(1);
  });
});
