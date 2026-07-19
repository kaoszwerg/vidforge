import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film } from "lucide-react";
import { IconButton } from "../components/ui/IconButton";
import { HudPanel } from "../components/ui/HudPanel";
import { MetaRow } from "../components/ui/MetaRow";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { QualityBadge } from "../components/QualityBadge";
import { VideoPlayer } from "../components/VideoPlayer";
import { useProbe } from "../hooks/useProbe";
import { useThumbnail } from "../hooks/useThumbnail";
import { useEnqueueJob, usePresets } from "../hooks/useJobs";
import { isConvertiblePreset, presetDescriptionKey, presetLabelKey } from "../lib/presets";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { formatBitrate, formatBytes, formatDuration, formatFps } from "../lib/format";

/** Derive a display name from an absolute path, tolerant of both `/` and `\` separators (a Windows
 * path arrives with backslashes, everything else with forward slashes). `MediaInfo` carries no file
 * name of its own — only `ScannedFile` does, and the Detail view is reachable from just a path (the
 * persisted selection in `useLibraryStore`), so it derives the name itself rather than requiring the
 * caller to also thread through the `ScannedFile`. */
function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts.at(-1) || path;
}

/** How long the "queued" confirmation stays visible after Convert/Repair (ADR-PROJ-001 §4) — long
 * enough to read, short enough that it does not linger as stale state once the user moves on; the job
 * itself keeps living in the status-bar process list regardless. */
const CONFIRMATION_MS = 4000;

export interface DetailViewProps {
  /** Absolute path of the video to show, as produced by `scan_folder`. */
  path: string;
  /** Called when the user activates the back control, to return to the Library grid. */
  onBack: () => void;
}

/**
 * Full technical metadata for one video (ADR-PROJ-001): container/duration/size/bitrate, the video
 * stream, every audio stream, every subtitle track, the thumbnail, a back control, the internal
 * `VideoPlayer` and the Convert/Repair actions that queue a job (`useEnqueueJob`) without blocking this
 * view — the job then lives in the status-bar process list.
 */
export function DetailView({ path, onBack }: DetailViewProps) {
  const t = useT();
  const probe = useProbe(path);
  const thumb = useThumbnail(path);
  const name = fileNameFromPath(path);

  const presets = usePresets();
  const enqueueJob = useEnqueueJob();
  const convertPresets = (presets.data ?? []).filter((p) => isConvertiblePreset(p.id));
  const [presetId, setPresetId] = useState("universal");
  const selectedPreset = convertPresets.find((p) => p.id === presetId);

  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmationTimeout = useRef<number | undefined>(undefined);
  // Clears any pending "dismiss the confirmation" timer if the view unmounts first (e.g. the user hits
  // Back right after enqueueing) — otherwise the timer would fire a setState on an unmounted component.
  useEffect(() => () => window.clearTimeout(confirmationTimeout.current), []);

  const enqueue = (idToUse: string) => {
    enqueueJob.mutate(
      { inputPath: path, presetId: idToUse },
      {
        onSuccess: () => {
          window.clearTimeout(confirmationTimeout.current);
          setConfirmation(t("detail.enqueued", { name }));
          confirmationTimeout.current = window.setTimeout(
            () => setConfirmation(null),
            CONFIRMATION_MS,
          );
        },
      },
    );
  };

  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <div className="flex items-center gap-3">
        <IconButton label={t("common.back")} onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={2} />
        </IconButton>
        <h1
          className="hud-label text-glow-cyan min-w-0 truncate"
          style={{ "--hud-label-size": "1rem" } as React.CSSProperties}
        >
          {name}
        </h1>
        {probe.data ? <QualityBadge tier={probe.data.quality} className="shrink-0" /> : null}
      </div>

      {probe.isPending ? (
        <HudPanel accent="cyan">
          <p className="text-dim text-sm">{t("common.loading")}</p>
        </HudPanel>
      ) : null}

      {probe.isError ? (
        <HudPanel accent="danger" label={t("detail.error.title")}>
          <p className="text-danger text-sm">{errorMessage(probe.error)}</p>
        </HudPanel>
      ) : null}

      {probe.data ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <HudPanel accent="cyan" className="overflow-hidden p-0">
            <div className="bg-elevated flex aspect-video w-full items-center justify-center overflow-hidden">
              {thumb.data ? (
                <img src={thumb.data} alt="" className="h-full w-full object-cover" />
              ) : (
                <Film size={40} className="text-dim" aria-hidden />
              )}
            </div>
          </HudPanel>

          <div className="space-y-4">
            <HudPanel accent="cyan" label={t("detail.panel.file")}>
              <dl className="text-dim grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
                <MetaRow k={t("detail.container")} v={probe.data.container} />
                <MetaRow
                  k={t("detail.duration")}
                  v={
                    probe.data.duration_secs != null
                      ? formatDuration(probe.data.duration_secs)
                      : "—"
                  }
                />
                <MetaRow k={t("detail.size")} v={formatBytes(probe.data.size_bytes)} />
                <MetaRow
                  k={t("detail.bitrate")}
                  v={probe.data.bit_rate != null ? formatBitrate(probe.data.bit_rate) : "—"}
                />
              </dl>
            </HudPanel>

            {probe.data.video ? (
              <HudPanel accent="green" label={t("detail.panel.video")}>
                <dl className="text-dim grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
                  <MetaRow
                    k={t("detail.resolution")}
                    v={`${probe.data.video.width}×${probe.data.video.height}`}
                  />
                  <MetaRow k={t("detail.codec")} v={probe.data.video.codec.toUpperCase()} />
                  <MetaRow k={t("detail.fps")} v={formatFps(probe.data.video.fps)} />
                  <MetaRow k={t("detail.pixfmt")} v={probe.data.video.pix_fmt ?? "—"} />
                  <MetaRow
                    k={t("detail.hdr")}
                    v={probe.data.video.hdr ? t("common.yes") : t("common.no")}
                  />
                  <MetaRow
                    k={t("detail.bitrate")}
                    v={
                      probe.data.video.bit_rate != null
                        ? formatBitrate(probe.data.video.bit_rate)
                        : "—"
                    }
                  />
                </dl>
              </HudPanel>
            ) : null}

            {probe.data.audio.length > 0 ? (
              <HudPanel accent="purple" label={t("detail.panel.audio")}>
                <div className="divide-elevated space-y-2 divide-y">
                  {probe.data.audio.map((a, i) => (
                    <dl
                      key={`${a.codec}-${i}`}
                      className="text-dim grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 font-mono text-xs first:pt-0"
                    >
                      <MetaRow k={t("detail.codec")} v={a.codec.toUpperCase()} />
                      <MetaRow k={t("detail.channels")} v={String(a.channels)} />
                      <MetaRow k={t("detail.sampleRate")} v={`${a.sample_rate} Hz`} />
                      <MetaRow
                        k={t("detail.bitrate")}
                        v={a.bit_rate != null ? formatBitrate(a.bit_rate) : "—"}
                      />
                      <MetaRow
                        k={t("detail.language")}
                        v={a.language ?? t("detail.language.unknown")}
                      />
                    </dl>
                  ))}
                </div>
              </HudPanel>
            ) : null}

            {probe.data.subtitles.length > 0 ? (
              <HudPanel accent="gold" label={t("detail.panel.subtitles")}>
                <ul className="text-dim space-y-1 text-sm">
                  {probe.data.subtitles.map((s, i) => (
                    <li key={`${s.codec}-${i}`}>
                      {s.codec} — {s.language ?? t("detail.language.unknown")}
                    </li>
                  ))}
                </ul>
              </HudPanel>
            ) : null}

            <HudPanel accent="cyan" label={t("detail.panel.player")}>
              <VideoPlayer path={path} />
            </HudPanel>

            <HudPanel accent="green" label={t("detail.panel.actions")}>
              <div className="space-y-3">
                {presets.isPending ? (
                  <p className="text-dim text-sm">{t("common.loading")}</p>
                ) : presets.isError ? (
                  <p className="text-danger text-sm">{errorMessage(presets.error)}</p>
                ) : (
                  <Select
                    label={t("preset.selectLabel")}
                    value={presetId}
                    onChange={setPresetId}
                    options={convertPresets.map((p) => ({
                      value: p.id,
                      label: t(presetLabelKey(p.id)),
                    }))}
                  />
                )}
                {selectedPreset ? (
                  <p className="text-dim text-xs">{t(presetDescriptionKey(selectedPreset.id))}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    accent="green"
                    onClick={() => enqueue(presetId)}
                    disabled={enqueueJob.isPending || convertPresets.length === 0}
                  >
                    {t("detail.convert")}
                  </Button>
                  <Button
                    accent="gold"
                    variant="ghost"
                    onClick={() => enqueue("repair")}
                    disabled={enqueueJob.isPending}
                  >
                    {t("detail.repair")}
                  </Button>
                </div>

                {confirmation ? <p className="text-green text-xs">{confirmation}</p> : null}
                {enqueueJob.isError ? (
                  <p className="text-danger text-xs">
                    {t("detail.enqueueError", { message: errorMessage(enqueueJob.error) })}
                  </p>
                ) : null}
              </div>
            </HudPanel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
