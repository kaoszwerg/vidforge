/**
 * The ffmpeg installer's button + live progress row + failure message (ADR-PROJ-001 §2), shared between
 * LibraryView's full-page "ffmpeg not found" notice and HomeView's compact ffmpeg status panel
 * (ADR-CORE-005, rule:reusability): both drive the same `useInstallFfmpeg` mutation and must derive an
 * identical progress/failure state from it, so that derivation lives once instead of risking the two
 * views quietly disagreeing about what "installing" or "failed" looks like.
 */
import { Button } from "./ui/Button";
import { ProgressBar } from "./ui/ProgressBar";
import type { UseInstallFfmpegResult } from "../hooks/useInstallFfmpeg";
import type { MessageKey } from "../i18n";
import { errorMessage } from "../lib/errors";
import { installPhaseLabelKey } from "../lib/installPhase";

export interface FfmpegInstallProgressProps {
  /** The live installer state from {@link useInstallFfmpeg}. */
  installFfmpeg: UseInstallFfmpegResult;
  /** Bound translator ({@link useT}), passed in rather than called here so this stays a plain
   * presentational component the caller renders inside its own tree without a second i18n lookup. */
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  className?: string;
}

/**
 * Install button, live progress bar and failure message for the in-app ffmpeg installer. `phase:
 * "error"` is treated as a failure the moment the event arrives — before the mutation promise itself has
 * settled — so the progress row swaps to the failure message immediately rather than sitting on a stale
 * "error" phase label for the remainder of `isInstalling`.
 */
export function FfmpegInstallProgress({
  installFfmpeg,
  t,
  className = "",
}: FfmpegInstallProgressProps) {
  const installProgress =
    installFfmpeg.isInstalling && installFfmpeg.progress?.phase !== "error"
      ? installFfmpeg.progress
      : null;
  const installFailed = installFfmpeg.progress?.phase === "error" || installFfmpeg.error != null;
  const installFailureDetail =
    installFfmpeg.progress?.phase === "error" && installFfmpeg.progress.message
      ? installFfmpeg.progress.message
      : installFfmpeg.error
        ? errorMessage(installFfmpeg.error)
        : null;

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <Button
        accent="cyan"
        onClick={() => installFfmpeg.install()}
        disabled={installFfmpeg.isInstalling}
        className="self-start"
      >
        {t("install.button")}
      </Button>
      {installProgress ? (
        <div className="flex flex-col gap-1">
          <div className="text-dim flex items-center justify-between text-xs">
            <span>{t(installPhaseLabelKey(installProgress.phase))}</span>
            {installProgress.percent >= 0 ? (
              <span>{Math.round(installProgress.percent)}%</span>
            ) : null}
          </div>
          <ProgressBar
            percent={installProgress.percent}
            indeterminate={installProgress.percent < 0}
          />
        </div>
      ) : null}
      {installFailed ? (
        <p className="text-danger text-xs" role="alert">
          {t("install.failed")}
          {installFailureDetail ? ` ${installFailureDetail}` : ""}
        </p>
      ) : null}
    </div>
  );
}
