import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { HudPanel } from "../components/ui/HudPanel";
import { Dropzone } from "../components/ui/Dropzone";
import { MetaRow } from "../components/ui/MetaRow";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { VideoCard, type SelectModifiers } from "../components/VideoCard";
import { DetailView } from "./DetailView";
import { api } from "../api/commands";
import { useFfmpegStatus } from "../hooks/useFfmpegStatus";
import { useScanFolder } from "../hooks/useScanFolder";
import { useEnqueueJob, usePresets } from "../hooks/useJobs";
import { useLibraryStore } from "../store/library";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { isConvertiblePreset, presetLabelKey } from "../lib/presets";

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
 *
 * **Selection model** (standard-OS multiselect, `useLibraryStore`): a **plain click** on a card both
 * narrows the bulk selection to exactly that card AND opens its Detail view — the existing
 * single-click-to-open behavior is preserved rather than replaced by a distinct "open" affordance.
 * **Ctrl/Cmd-click** toggles a card's membership and **Shift-click** selects the range from the last
 * clicked card, neither of which navigates away — that is how a selection of more than one card is ever
 * built. **Ctrl/Cmd+A** selects every scanned file; **Escape** clears the selection. Both shortcuts are
 * only live while the grid itself is showing (not the Detail view).
 */
export function LibraryView() {
  const t = useT();
  const folder = useLibraryStore((s) => s.folder);
  const setFolder = useLibraryStore((s) => s.setFolder);
  const selectedPath = useLibraryStore((s) => s.selectedPath);
  const selectVideo = useLibraryStore((s) => s.selectVideo);
  const selected = useLibraryStore((s) => s.selected);
  const lastClickedPath = useLibraryStore((s) => s.lastClickedPath);
  const selectOnly = useLibraryStore((s) => s.selectOnly);
  const toggleSelected = useLibraryStore((s) => s.toggleSelected);
  const setSelectedPaths = useLibraryStore((s) => s.setSelectedPaths);
  const clearSelection = useLibraryStore((s) => s.clearSelection);

  const ffmpeg = useFfmpegStatus();
  const scan = useScanFolder(folder);

  const presets = usePresets();
  const enqueueJob = useEnqueueJob();
  const convertPresets = (presets.data ?? []).filter((p) => isConvertiblePreset(p.id));
  const [bulkPresetId, setBulkPresetId] = useState("universal");

  const handleBrowse = () => {
    void api.pickFolder().then((picked) => {
      if (picked) setFolder(picked);
    });
  };

  const handleCardSelect = (path: string, mods: SelectModifiers) => {
    if (mods.shift && lastClickedPath && scan.data) {
      const paths = scan.data.map((f) => f.path);
      const from = paths.indexOf(lastClickedPath);
      const to = paths.indexOf(path);
      if (from !== -1 && to !== -1) {
        const [start, end] = from <= to ? [from, to] : [to, from];
        setSelectedPaths(paths.slice(start, end + 1));
        return;
      }
    }
    if (mods.ctrl || mods.meta) {
      toggleSelected(path);
      return;
    }
    // Plain click: see the selection-model note on the view's doc comment above.
    selectOnly(path);
    selectVideo(path);
  };

  const handleBulkConvert = () => {
    for (const path of selected) {
      enqueueJob.mutate({ inputPath: path, presetId: bulkPresetId });
    }
    clearSelection();
  };

  // Ctrl/Cmd+A and Escape — only while the grid itself is shown, not the Detail view.
  useEffect(() => {
    if (selectedPath) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (!scan.data || scan.data.length === 0) return;
        e.preventDefault();
        setSelectedPaths(scan.data.map((f) => f.path));
      } else if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPath, scan.data, setSelectedPaths, clearSelection]);

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

      {selected.size > 0 ? (
        <HudPanel accent="green">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-fg text-sm">
                {t("library.selectCount", { count: selected.size })}
              </span>
              <Button variant="ghost" onClick={clearSelection}>
                {t("library.selectClear")}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {presets.isPending ? (
                <span className="text-dim text-xs">{t("common.loading")}</span>
              ) : (
                <Select
                  label={t("preset.selectLabel")}
                  value={bulkPresetId}
                  onChange={setBulkPresetId}
                  options={convertPresets.map((p) => ({
                    value: p.id,
                    label: t(presetLabelKey(p.id)),
                  }))}
                />
              )}
              <Button
                accent="green"
                onClick={handleBulkConvert}
                disabled={enqueueJob.isPending || convertPresets.length === 0}
              >
                {t("library.selectConvert")}
              </Button>
            </div>
          </div>
        </HudPanel>
      ) : null}

      {scan.data && scan.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {scan.data.map((file) => (
            <VideoCard
              key={file.path}
              file={file}
              onSelect={handleCardSelect}
              selected={selected.has(file.path)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
