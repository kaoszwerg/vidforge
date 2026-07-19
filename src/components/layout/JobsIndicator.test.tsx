import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobsIndicator } from "./JobsIndicator";
import type { UseJobsResult } from "../../hooks/useJobs";
import type { JobDto } from "../../bindings/JobDto";

vi.mock("../../hooks/useSettings", () => ({ useSettings: vi.fn(), useUpdateSettings: vi.fn() }));
vi.mock("../../hooks/useJobs", async () => {
  const actual = await vi.importActual<typeof import("../../hooks/useJobs")>("../../hooks/useJobs");
  return { ...actual, useCancelJob: vi.fn() };
});

import { useSettings } from "../../hooks/useSettings";
import { useCancelJob } from "../../hooks/useJobs";

function job(overrides: Partial<JobDto> = {}): JobDto {
  return {
    id: "job-1",
    input_path: "/videos/a.mp4",
    input_name: "a.mp4",
    output_path: "/out/a.mp4",
    preset_id: "universal",
    state: "Queued",
    percent: 0,
    error: null,
    ...overrides,
  };
}

function jobsResult(overrides: Partial<UseJobsResult> = {}): UseJobsResult {
  return {
    jobs: [],
    isLoading: false,
    error: null,
    running: 0,
    queued: 0,
    active: false,
    ...overrides,
  };
}

const cancelMutate = vi.fn();

function renderIndicator(jobs: UseJobsResult) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <JobsIndicator jobs={jobs} />
    </QueryClientProvider>,
  );
}

describe("JobsIndicator", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    cancelMutate.mockReset();
    vi.mocked(useCancelJob).mockReturnValue({ mutate: cancelMutate } as unknown as ReturnType<
      typeof useCancelJob
    >);
  });

  it("shows a minimal idle state with no active jobs", () => {
    renderIndicator(jobsResult());
    const trigger = screen.getByRole("button", { name: "Keine aktiven Aufgaben" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it("shows the active count and spinner while jobs are running/queued", () => {
    renderIndicator(jobsResult({ running: 1, queued: 2, active: true }));
    expect(screen.getByRole("button", { name: "1 laufend, 2 wartend" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("is closed until the trigger is clicked", () => {
    renderIndicator(jobsResult());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Keine aktiven Aufgaben" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the empty message when there are no jobs at all", () => {
    renderIndicator(jobsResult());
    fireEvent.click(screen.getByRole("button", { name: "Keine aktiven Aufgaben" }));
    expect(screen.getByText("Keine Aufgaben.")).toBeInTheDocument();
  });

  it("lists a running job with its progress and a cancel control", () => {
    renderIndicator(
      jobsResult({
        jobs: [job({ state: "Running", percent: 42 })],
        running: 1,
        active: true,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "1 laufend, 0 wartend" }));

    expect(screen.getByText("a.mp4")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(cancelMutate).toHaveBeenCalledWith("job-1");
  });

  it("lists a queued job with a cancel control but no progress bar", () => {
    renderIndicator(jobsResult({ jobs: [job({ state: "Queued" })], queued: 1, active: true }));
    fireEvent.click(screen.getByRole("button", { name: "0 laufend, 1 wartend" }));

    expect(screen.getByText("a.mp4")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
  });

  it("shows finished jobs without a cancel control, most recent first", () => {
    renderIndicator(
      jobsResult({
        jobs: [
          job({ id: "first", input_name: "first.mp4", state: "Done" }),
          job({ id: "second", input_name: "second.mp4", state: "Failed", error: "boom" }),
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Keine aktiven Aufgaben" }));

    const names = screen.getAllByText(/\.mp4$/).map((el) => el.textContent);
    expect(names).toEqual(["second.mp4", "first.mp4"]);
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abbrechen" })).toBeNull();
  });

  it("closes on Escape", () => {
    renderIndicator(jobsResult());
    fireEvent.click(screen.getByRole("button", { name: "Keine aktiven Aufgaben" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on an outside click", () => {
    renderIndicator(jobsResult());
    fireEvent.click(screen.getByRole("button", { name: "Keine aktiven Aufgaben" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
