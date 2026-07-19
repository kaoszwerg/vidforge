import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CrashBoundary } from "./CrashBoundary";
import { settingsDto } from "../test/settings";

vi.mock("../api/commands", () => ({
  api: {
    reportCrash: vi.fn(() => Promise.resolve("/data/crashes/crash-1.log")),
    exitAfterCrash: vi.fn(() => Promise.resolve()),
    getSettings: vi.fn(),
  },
}));
const { api } = await import("../api/commands");
const reportCrashMock = vi.mocked(api.reportCrash);

function Boom(): React.ReactElement {
  throw new Error("render exploded");
}

// FatalScreen (rendered by CrashBoundary once it catches) reads the UI language via `useT`/
// `useSettings`, so it needs a QueryClientProvider ancestor even in isolation — exactly the dependency
// `main.tsx` also has to carry across its own fatal-screen render paths (see main.tsx's `showFatal`).
function renderBoundary(children: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CrashBoundary>{children}</CrashBoundary>
    </QueryClientProvider>,
  );
}

describe("CrashBoundary", () => {
  // React logs the caught error to console.error by design; silence it so the suite output stays
  // readable, but assert on the boundary's behaviour, not on React's noise.
  beforeEach(() => {
    reportCrashMock.mockClear();
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders its children when nothing throws", () => {
    renderBoundary(<p>all good</p>);
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("replaces the failed tree with the fatal screen and never re-renders the children", async () => {
    renderBoundary(<Boom />);

    expect(await screen.findByText("Schwerwiegender Fehler")).toBeInTheDocument();
    expect(screen.getByText("render exploded")).toBeInTheDocument();
    // The failed unit is discarded, never resumed (rule:crash-handling): no "try again" that would put
    // the same broken tree back on screen.
    expect(screen.queryByRole("button", { name: /try again|retry|resume/i })).toBeNull();
  });

  it("reports the render crash to the durable on-device record", async () => {
    renderBoundary(<Boom />);

    await vi.waitFor(() =>
      expect(reportCrashMock).toHaveBeenCalledWith(
        expect.objectContaining({ source: "render", message: "render exploded" }),
      ),
    );
  });

  it("shows the user where the crash report is", async () => {
    renderBoundary(<Boom />);

    expect(await screen.findByText("/data/crashes/crash-1.log")).toBeInTheDocument();
  });

  it("still shows a fatal screen when the report itself cannot be delivered", async () => {
    reportCrashMock.mockRejectedValueOnce(new Error("ipc down"));

    renderBoundary(<Boom />);

    expect(await screen.findByText("Schwerwiegender Fehler")).toBeInTheDocument();
    expect(
      await screen.findByText(/Absturzbericht konnte nicht geschrieben werden/i),
    ).toBeInTheDocument();
  });
});
