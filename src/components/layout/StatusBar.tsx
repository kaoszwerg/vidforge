import { Button } from "../ui/Button";
import { JobsIndicator } from "./JobsIndicator";
import { useBuildInfo } from "../../hooks/useBuildInfo";
import type { UseJobsResult } from "../../hooks/useJobs";
import { useT } from "../../i18n";
import { useUiStore } from "../../store/ui";
import { APP_NAME } from "../../lib/app";

/** Bottom status strip: build identity (click → About dialog), the scroll-to-top control, and the
 * clickable job-queue indicator (bottom-right, `JobsIndicator`) — `jobs` is computed once in `App` via
 * `useJobs()` and passed down, the same pattern `canScrollTop`/`onScrollTop` already use, so the queue's
 * live event subscription is not re-established once per consumer. */
export function StatusBar({
  canScrollTop = false,
  onScrollTop,
  jobs,
}: {
  canScrollTop?: boolean;
  onScrollTop?: () => void;
  jobs: UseJobsResult;
}) {
  const { data: build } = useBuildInfo();
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);
  const t = useT();

  return (
    <div
      // The strip sits flush against the window's bottom edge, which is chamfered ~20px at the
      // bottom-right and ~10px at the bottom-left by `--hud-window-clip` (globals.css) — content
      // closer than that to a corner is clipped by the window's own clip-path. `px-5` (20px) keeps
      // both the About control (left) and the JobsIndicator (right) clear of either chamfer; the
      // extra height + bottom padding gives the row's own content a further margin from the true
      // bottom edge.
      className="hud-strip hud-strip-bottom flex h-8 shrink-0 items-center justify-between px-5 pb-0.5 font-mono text-[10px] text-[var(--saga-text-dim)]"
    >
      <Button
        variant="ghost"
        onClick={() => setAboutOpen(true)}
        tooltip={t("statusbar.aboutTooltip", { name: APP_NAME })}
      >
        {APP_NAME} {build ? `v${build.version}` : ""}
        {build ? (
          <span className="text-dim ml-1">
            ({build.git_sha}
            {build.git_dirty ? "+" : ""})
          </span>
        ) : null}
        {build?.channel === "dev" ? (
          <span className="text-gold ml-1">· {t("statusbar.devSuffix")}</span>
        ) : null}
      </Button>
      <div className="flex items-center gap-3">
        {canScrollTop ? (
          <Button
            variant="ghost"
            onClick={onScrollTop}
            aria-label={t("statusbar.scrollToTop")}
            tooltip={t("statusbar.scrollToTop")}
            className="tracking-wider uppercase"
          >
            {t("statusbar.scrollToTopShort")}
          </Button>
        ) : null}
        <JobsIndicator jobs={jobs} />
      </div>
    </div>
  );
}
