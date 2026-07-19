import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Ban, CheckCircle2, Clock, ListChecks, Loader2, X, XOctagon } from "lucide-react";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { ProgressBar } from "../ui/ProgressBar";
import { hudAccentTextClass, type HudAccent } from "../ui/hudButton";
import { useCancelJob, type UseJobsResult } from "../../hooks/useJobs";
import { presetLabelKey } from "../../lib/presets";
import { useT } from "../../i18n";
import type { MessageKey } from "../../i18n";
import type { JobDto } from "../../bindings/JobDto";
import type { JobState } from "../../bindings/JobState";

/** How many finished (Done/Failed/Cancelled) jobs the popover keeps visible — a compact recent history,
 * not the full job log. */
const RECENT_LIMIT = 5;

function accentForState(state: JobState): HudAccent {
  switch (state) {
    case "Running":
      return "cyan";
    case "Queued":
      return "purple";
    case "Done":
      return "green";
    case "Failed":
      return "danger";
    case "Cancelled":
      return "gold";
  }
}

function stateLabelKey(state: JobState): MessageKey {
  switch (state) {
    case "Running":
      return "jobs.state.running";
    case "Queued":
      return "jobs.state.queued";
    case "Done":
      return "jobs.state.done";
    case "Failed":
      return "jobs.state.failed";
    case "Cancelled":
      return "jobs.state.cancelled";
  }
}

/** Lifecycle icon per job state — one map so a `Running` job always draws the same spinner everywhere
 * this popover renders it (ADR-CORE-005). */
const STATE_ICON: Record<JobState, typeof Loader2> = {
  Running: Loader2,
  Queued: Clock,
  Done: CheckCircle2,
  Failed: XOctagon,
  Cancelled: Ban,
};

/** One job row in the popover: icon + name + preset + state, a live `ProgressBar` while `Running`, a
 * cancel affordance while cancellable (`Queued`/`Running`), and the failure detail when `Failed`. */
function JobRow({ job }: { job: JobDto }) {
  const t = useT();
  const cancelJob = useCancelJob();
  const accent = accentForState(job.state);
  const cancellable = job.state === "Running" || job.state === "Queued";
  const Icon = STATE_ICON[job.state];

  return (
    <li className="flex flex-col gap-1 py-1.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Icon
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 ${hudAccentTextClass(accent)} ${job.state === "Running" ? "animate-spin" : ""}`}
          aria-hidden
        />
        <span className="text-fg min-w-0 flex-1 truncate text-xs">{job.input_name}</span>
        <span
          className={`shrink-0 font-mono text-[9px] tracking-wider uppercase ${hudAccentTextClass(accent)}`}
        >
          {t(stateLabelKey(job.state))}
        </span>
        {cancellable ? (
          <IconButton
            label={t("jobs.cancel")}
            variant="ghost"
            accent="danger"
            className="shrink-0"
            onClick={() => cancelJob.mutate(job.id)}
          >
            <X size={11} strokeWidth={2.5} />
          </IconButton>
        ) : null}
      </div>
      <div className="text-dim flex items-center gap-2 pl-[18px] font-mono text-[10px]">
        <span className="truncate">{t(presetLabelKey(job.preset_id))}</span>
        {job.state === "Running" ? (
          <span className="shrink-0">{Math.round(job.percent)}%</span>
        ) : null}
      </div>
      {job.state === "Running" ? (
        <ProgressBar percent={job.percent} accent={accent} className="ml-[18px] w-auto" />
      ) : null}
      {job.state === "Failed" && job.error ? (
        <p className="text-danger truncate pl-[18px] text-[10px]" role="alert">
          {job.error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Clickable status-bar job indicator (ADR-PROJ-001 §4): a minimal, dim icon while the queue is idle; a
 * spinning cyan icon plus the active count while jobs are running/queued. Clicking opens a popover
 * (portal, outside-click + Escape close — mirrors `Select`/`Tooltip`) listing the active jobs first, then
 * a compact recent-history tail of finished ones.
 */
export function JobsIndicator({ jobs }: { jobs: UseJobsResult }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    if (!open) {
      const r = e.currentTarget.getBoundingClientRect();
      setPos({ bottom: window.innerHeight - r.top + 6, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  const activeJobs = jobs.jobs.filter((j) => j.state === "Running" || j.state === "Queued");
  const recent = jobs.jobs
    .filter((j) => j.state === "Done" || j.state === "Failed" || j.state === "Cancelled")
    .slice(-RECENT_LIMIT)
    .reverse();

  const tooltip = jobs.active
    ? t("statusbar.jobsActiveTooltip", { running: jobs.running, queued: jobs.queued })
    : t("statusbar.jobsIdleTooltip");

  return (
    <>
      <Button
        variant="ghost"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={tooltip}
        tooltip={tooltip}
        className={`flex items-center gap-1.5 ${jobs.active ? "" : "opacity-70"}`}
      >
        {jobs.active ? (
          <Loader2 size={12} strokeWidth={2.5} className="text-cyan animate-spin" aria-hidden />
        ) : (
          <ListChecks size={12} strokeWidth={2.5} className="text-dim" aria-hidden />
        )}
        {jobs.active ? (
          <span className="text-cyan font-mono text-[10px]">{jobs.running + jobs.queued}</span>
        ) : null}
      </Button>
      {open
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[70]"
                role="presentation"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-label={t("jobs.popover.title")}
                className="hud-popover hud-clip-sm hud-accent-cyan fixed z-[71] flex max-h-[70vh] w-80 flex-col overflow-hidden"
                style={{ bottom: pos.bottom, right: pos.right }}
              >
                <div
                  className="hud-label shrink-0 px-3 py-2"
                  style={{ "--hud-label-size": "0.65rem" } as CSSProperties}
                >
                  {t("jobs.popover.title")}
                </div>
                <div className="overflow-y-auto px-3 pb-2">
                  {jobs.jobs.length === 0 ? (
                    <p className="text-dim py-2 text-xs">{t("jobs.popover.empty")}</p>
                  ) : (
                    <>
                      {activeJobs.length > 0 ? (
                        <ul className="divide-elevated divide-y">
                          {activeJobs.map((j) => (
                            <JobRow key={j.id} job={j} />
                          ))}
                        </ul>
                      ) : null}
                      {recent.length > 0 ? (
                        <>
                          <div className="text-dim mt-2 mb-1 font-mono text-[9px] tracking-widest uppercase">
                            {t("jobs.popover.recent")}
                          </div>
                          <ul className="divide-elevated divide-y">
                            {recent.map((j) => (
                              <JobRow key={j.id} job={j} />
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
