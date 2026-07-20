import { HudPanel } from "../components/ui/HudPanel";
import { Button } from "../components/ui/Button";
import { MetaRow } from "../components/ui/MetaRow";
import { FfmpegInstallProgress } from "../components/FfmpegInstallProgress";
import { api } from "../api/commands";
import { useBuildInfo } from "../hooks/useBuildInfo";
import { useFfmpegStatus } from "../hooks/useFfmpegStatus";
import { useInstallFfmpeg } from "../hooks/useInstallFfmpeg";
import { useJobs, usePresets } from "../hooks/useJobs";
import { useLibraryStore } from "../store/library";
import { useUiStore } from "../store/ui";
import { useT } from "../i18n";
import { APP_NAME, APP_TAGLINE } from "../lib/app";
import { presetDescriptionKey, presetLabelKey } from "../lib/presets";

/**
 * Dashboard/landing view (ADR-PROJ-001): the app's front door, not a feature of its own — it orients the
 * user (what Vidforge does), gets them into the Library (the one green primary action, "Choose a
 * folder") and surfaces the state every other view depends on (ffmpeg availability, the job queue, the
 * available presets, the build identity) without duplicating any of it — every number here is read
 * straight from the same hooks the Library/Detail/Settings views use (ADR-CORE-005).
 *
 * Colour discipline: green is reserved for the Start panel's primary action; every other panel is cyan,
 * except the ffmpeg panel, which turns danger when the suite is missing — matching LibraryView's own
 * "not found" treatment (ADR-CORE-037: a missing dependency is a first-class state, never a crash).
 */
export function HomeView() {
  const t = useT();
  const folder = useLibraryStore((s) => s.folder);
  const setFolder = useLibraryStore((s) => s.setFolder);
  const setView = useUiStore((s) => s.setView);

  const ffmpeg = useFfmpegStatus();
  const installFfmpeg = useInstallFfmpeg();
  const jobs = useJobs();
  const presets = usePresets();
  const { data: build } = useBuildInfo();

  const handleChooseFolder = () => {
    void api.pickFolder().then((picked) => {
      if (!picked) return;
      setFolder(picked);
      setView("library");
    });
  };

  const ffmpegReady = ffmpeg.data?.ready ?? false;
  const doneCount = jobs.jobs.filter((j) => j.state === "Done").length;

  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <header className="space-y-1">
        <h1
          className="text-glow-cyan text-2xl"
          style={{ fontFamily: "Orbitron, sans-serif", letterSpacing: "0.12em" }}
        >
          {APP_NAME}
        </h1>
        <p className="text-green font-mono text-xs tracking-wide">{APP_TAGLINE}</p>
        <p className="text-dim max-w-2xl text-sm leading-relaxed">{t("home.intro")}</p>
      </header>

      <HudPanel accent="green" label={t("home.start.title")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-dim max-w-xl text-sm leading-relaxed">{t("home.start.body")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button accent="green" onClick={handleChooseFolder} className="px-4 py-1.5 text-xs">
              {t("home.start.choose")}
            </Button>
            {folder ? (
              <Button
                variant="ghost"
                onClick={() => setView("library")}
                className="max-w-[240px] truncate"
              >
                {t("home.start.continue", { folder })}
              </Button>
            ) : null}
          </div>
        </div>
      </HudPanel>

      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel accent={ffmpegReady ? "cyan" : "danger"} label={t("home.ffmpeg.title")}>
          {ffmpeg.isPending ? (
            <p className="text-dim text-sm">{t("common.loading")}</p>
          ) : ffmpegReady && ffmpeg.data ? (
            <dl className="text-dim grid grid-cols-1 gap-x-4 gap-y-1.5 font-mono text-xs">
              <MetaRow
                k="ffmpeg"
                v={
                  ffmpeg.data.ffmpeg
                    ? `${ffmpeg.data.ffmpeg.version} (${ffmpeg.data.ffmpeg.source})`
                    : "—"
                }
              />
              <MetaRow
                k="ffprobe"
                v={
                  ffmpeg.data.ffprobe
                    ? `${ffmpeg.data.ffprobe.version} (${ffmpeg.data.ffprobe.source})`
                    : "—"
                }
              />
            </dl>
          ) : (
            <div className="space-y-2">
              <p className="text-dim text-sm leading-relaxed">{t("home.ffmpeg.missing")}</p>
              <FfmpegInstallProgress installFfmpeg={installFfmpeg} t={t} />
            </div>
          )}
        </HudPanel>

        <HudPanel accent="cyan" label={t("home.activity.title")}>
          {jobs.isLoading ? (
            <p className="text-dim text-sm">{t("common.loading")}</p>
          ) : jobs.jobs.length === 0 ? (
            <p className="text-dim text-sm">{t("home.activity.idle")}</p>
          ) : (
            <dl className="text-dim grid grid-cols-1 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-3">
              <MetaRow k={t("home.activity.running")} v={String(jobs.running)} />
              <MetaRow k={t("home.activity.queued")} v={String(jobs.queued)} />
              <MetaRow k={t("home.activity.done")} v={String(doneCount)} />
            </dl>
          )}
          <p className="text-dim mt-3 text-xs leading-relaxed">{t("home.activity.hint")}</p>
        </HudPanel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel accent="cyan" label={t("home.presets.title")}>
          {presets.isPending ? (
            <p className="text-dim text-sm">{t("common.loading")}</p>
          ) : (
            <ul className="space-y-2">
              {(presets.data ?? []).map((p) => (
                <li key={p.id}>
                  <div className="text-fg text-sm font-medium">{t(presetLabelKey(p.id))}</div>
                  <div className="text-dim text-xs leading-relaxed">
                    {t(presetDescriptionKey(p.id))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HudPanel>

        <HudPanel accent="cyan" label={t("home.build.title")}>
          <dl className="text-dim grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
            <MetaRow k={t("common.meta.version")} v={build ? `v${build.version}` : "—"} />
            <MetaRow k={t("common.meta.channel")} v={build?.channel ?? "—"} />
            <MetaRow
              k={t("common.meta.commit")}
              v={build ? `${build.git_sha}${build.git_dirty ? "+" : ""}` : "—"}
            />
          </dl>
        </HudPanel>
      </div>
    </div>
  );
}
