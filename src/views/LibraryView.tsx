import { AlertTriangle } from "lucide-react";
import { HudPanel } from "../components/ui/HudPanel";
import { Dropzone } from "../components/ui/Dropzone";
import { MetaRow } from "../components/ui/MetaRow";
import { VideoCard } from "../components/VideoCard";
import { DetailView } from "./DetailView";
import { api } from "../api/commands";
import { useFfmpegStatus } from "../hooks/useFfmpegStatus";
import { useScanFolder } from "../hooks/useScanFolder";
import { useLibraryStore } from "../store/library";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";

/**
 * Library view (ADR-PROJ-001): pick or drop a folder, scan it, and show one card per video in a
 * responsive grid. Selecting a card replaces the grid with the `DetailView` for that video — Detail is
 * not its own nav entry, it lives inside this one (`useLibraryStore.selectedPath`).
 *
 * ffmpeg/ffprobe availability gates everything else (ADR-CORE-037: "not found" is a first-class state,
 * never a crash): scanning and probing both shell out to them, so the view checks `useFfmpegStatus`
 * first and shows a HUD notice — with whatever paths *were* resolved — instead of a grid that would
 * only fail once the user tries to use it. The in-app installer button is a later slice (`PLAN.md`
 * Phase 1); this view only surfaces the state.
 */
export function LibraryView() {
  const t = useT();
  const folder = useLibraryStore((s) => s.folder);
  const setFolder = useLibraryStore((s) => s.setFolder);
  const selectedPath = useLibraryStore((s) => s.selectedPath);
  const selectVideo = useLibraryStore((s) => s.selectVideo);

  const ffmpeg = useFfmpegStatus();
  const scan = useScanFolder(folder);

  const handleBrowse = () => {
    void api.pickFolder().then((picked) => {
      if (picked) setFolder(picked);
    });
  };

  if (selectedPath) {
    return <DetailView path={selectedPath} onBack={() => selectVideo(null)} />;
  }

  if (ffmpeg.isPending) {
    return (
      <div className="h-full p-6">
        <HudPanel accent="cyan">
          <p className="text-dim text-sm">{t("common.loading")}</p>
        </HudPanel>
      </div>
    );
  }

  if (ffmpeg.isError) {
    return (
      <div className="h-full p-6">
        <HudPanel accent="danger" label={t("library.ffmpegMissing.title")}>
          <p className="text-danger text-sm">{errorMessage(ffmpeg.error)}</p>
        </HudPanel>
      </div>
    );
  }

  if (ffmpeg.data && !ffmpeg.data.ready) {
    return (
      <div className="h-full space-y-4 overflow-auto p-6">
        <HudPanel accent="danger" label={t("library.ffmpegMissing.title")}>
          <p className="text-dim text-sm leading-relaxed">{t("library.ffmpegMissing.body")}</p>
          <dl className="text-dim mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
            <MetaRow k="ffmpeg" v={ffmpeg.data.ffmpeg?.path ?? "—"} />
            <MetaRow k="ffprobe" v={ffmpeg.data.ffprobe?.path ?? "—"} />
          </dl>
        </HudPanel>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <Dropzone onFolderDropped={setFolder} onBrowse={handleBrowse}>
        <p className="text-dim truncate text-sm">{folder ?? t("library.dropzone.label")}</p>
      </Dropzone>

      {scan.isPending && folder ? (
        <HudPanel accent="cyan">
          <p className="text-dim text-sm">{t("library.scanning")}</p>
        </HudPanel>
      ) : null}

      {scan.isError ? (
        <HudPanel accent="danger" label={t("library.scanError.title")}>
          <p className="text-danger flex items-center gap-2 text-sm">
            <AlertTriangle size={14} aria-hidden />
            {errorMessage(scan.error)}
          </p>
        </HudPanel>
      ) : null}

      {scan.data && scan.data.length === 0 ? (
        <HudPanel accent="gold">
          <p className="text-dim text-sm">{t("library.empty")}</p>
        </HudPanel>
      ) : null}

      {scan.data && scan.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {scan.data.map((file) => (
            <VideoCard key={file.path} file={file} onSelect={selectVideo} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
