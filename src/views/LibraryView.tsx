import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search, X } from "lucide-react";
import { HudPanel } from "../components/ui/HudPanel";
import { Dropzone } from "../components/ui/Dropzone";
import { MetaRow } from "../components/ui/MetaRow";
import { Select } from "../components/ui/Select";
import { TextField } from "../components/ui/TextField";
import { Button } from "../components/ui/Button";
import { IconButton } from "../components/ui/IconButton";
import { FfmpegInstallProgress } from "../components/FfmpegInstallProgress";
import { FolderBrowser } from "../components/FolderBrowser";
import { VideoCard, type SelectModifiers } from "../components/VideoCard";
import { DetailView } from "./DetailView";
import { useFfmpegStatus } from "../hooks/useFfmpegStatus";
import { useInstallFfmpeg } from "../hooks/useInstallFfmpeg";
import { useScanFolder } from "../hooks/useScanFolder";
import { useEnqueueJob, usePresets } from "../hooks/useJobs";
import { useBulkIntegrityCheck } from "../hooks/useBulkIntegrityCheck";
import { useLibraryStore } from "../store/library";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { isConvertiblePreset, presetLabelKey } from "../lib/presets";
import {
  applyLibraryViewOptions,
  libraryExtensions,
  librarySortLabelKey,
  LIBRARY_FILTER_ALL,
  LIBRARY_SORT_ORDERS,
  type LibrarySortOrder,
} from "../lib/librarySort";

/**
 * Library view (ADR-PROJ-001): pick or drop a folder, scan it, and show one card per video in a
 * responsive grid. Selecting a card replaces the grid with the `DetailView` for that video — Detail is
 * not its own nav entry, it lives inside this one (`useLibraryStore.selectedPath`).
 *
 * ffmpeg/ffprobe availability gates everything else (ADR-CORE-037: "not found" is a first-class state,
 * never a crash): scanning and probing both shell out to them, so the view checks `useFfmpegStatus`
 * first and shows a HUD notice — with whatever paths *were* resolved, an in-app installer
 * (`useInstallFfmpeg`) with live progress, and the failure detail on `phase: "error"` or a rejected
 * install — instead of a grid that would only fail once the user tries to use it.
 *
 * **Selection model** (standard-OS multiselect, `useLibraryStore`): a **plain click** on a card both
 * narrows the bulk selection to exactly that card AND opens its Detail view — the existing
 * single-click-to-open behavior is preserved rather than replaced by a distinct "open" affordance.
 * **Ctrl/Cmd-click** toggles a card's membership and **Shift-click** selects the range from the last
 * clicked card, neither of which navigates away — that is how a selection of more than one card is ever
 * built. **Ctrl/Cmd+A** selects every currently *displayed* file (after the toolbar's search/filter, in
 * its current sort order — never a file hidden by the current filter); **Escape** clears the selection.
 * Both shortcuts are only live while the grid itself is showing (not the Detail view). A `Checkbox` on
 * each card (`VideoCard`) is the primary, discoverable way to build a selection; the modifier-click
 * mechanics above remain available for anyone who already reaches for them.
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
  const installFfmpeg = useInstallFfmpeg();
  const scan = useScanFolder(folder);

  const presets = usePresets();
  const enqueueJob = useEnqueueJob();
  const convertPresets = (presets.data ?? []).filter((p) => isConvertiblePreset(p.id));
  const [bulkPresetId, setBulkPresetId] = useState("universal");

  // Search/sort/filter toolbar state (LibraryView, not the store — purely local view state, scoped to
  // "what I'm currently looking for in this folder"). Reset when `folder` changes — adjusted during
  // render (React's documented pattern for "reset state when a prop changes", not an effect: an effect
  // that calls setState synchronously on every run is a cascading extra render,
  // react-hooks/set-state-in-effect) — the same way the store already clears the selection on a new
  // folder.
  const [browserOpen, setBrowserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySortOrder>("name-asc");
  const [extension, setExtension] = useState<string>(LIBRARY_FILTER_ALL);
  const [resetForFolder, setResetForFolder] = useState(folder);
  if (folder !== resetForFolder) {
    setResetForFolder(folder);
    setQuery("");
    setExtension(LIBRARY_FILTER_ALL);
  }

  const scannedFiles = useMemo(() => scan.data ?? [], [scan.data]);
  const extensions = useMemo(() => libraryExtensions(scannedFiles), [scannedFiles]);
  const filteredFiles = useMemo(
    () => applyLibraryViewOptions(scannedFiles, { query, extension, sort }),
    [scannedFiles, query, extension, sort],
  );

  // Opens the in-app HUD folder browser (ADR-PROJ-001) instead of the OS-native dialog (owner decision).
  const handleBrowse = () => setBrowserOpen(true);

  const handleCardSelect = (path: string, mods: SelectModifiers) => {
    // Range/select-all operate over the currently *displayed* order (`filteredFiles`), not the raw
    // scan — once the toolbar has searched/filtered/sorted, Shift-click and Ctrl+A must match what the
    // user actually sees, or Ctrl+A would silently also select files hidden by the current filter.
    if (mods.shift && lastClickedPath && filteredFiles.length > 0) {
      const paths = filteredFiles.map((f) => f.path);
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

  // Bulk deep integrity check over the selected files (owner: bulk defect check), throttled by its own
  // pool (useBulkIntegrityCheck). Repairing the defective ones reuses the existing repair job — one place
  // for repair (ADR-CORE-005) — and clears the batch.
  const bulkCheck = useBulkIntegrityCheck();
  const handleBulkCheck = () => bulkCheck.start(Array.from(selected));
  const handleRepairDefective = () => {
    for (const report of bulkCheck.defective) {
      enqueueJob.mutate({ inputPath: report.path, presetId: "repair" });
    }
    bulkCheck.reset();
    clearSelection();
  };

  // Ctrl/Cmd+A and Escape — only while the grid itself is shown, not the Detail view. Ctrl/Cmd+A selects
  // every currently *displayed* file (`filteredFiles`), matching the Shift-click range above.
  useEffect(() => {
    if (selectedPath) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (filteredFiles.length === 0) return;
        e.preventDefault();
        setSelectedPaths(filteredFiles.map((f) => f.path));
      } else if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPath, filteredFiles, setSelectedPaths, clearSelection]);

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
          <p className="text-dim mt-3 text-xs leading-relaxed">{t("install.explain")}</p>
          <FfmpegInstallProgress installFfmpeg={installFfmpeg} t={t} className="mt-3" />
        </HudPanel>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <FolderBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onChoose={setFolder}
        initialPath={folder}
      />
      <Dropzone onFolderDropped={setFolder} onBrowse={handleBrowse} compact={folder != null}>
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <span
              className="hud-label"
              style={{ "--hud-label-size": "0.6875rem" } as CSSProperties}
            >
              {t("library.toolbar.searchLabel")}
            </span>
            <div className="relative">
              <Search
                size={12}
                strokeWidth={2}
                className="text-dim pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
                aria-hidden
              />
              <TextField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("library.toolbar.searchPlaceholder")}
                aria-label={t("library.toolbar.searchAriaLabel")}
                className="w-40 pr-7 pl-6"
              />
              {query ? (
                <IconButton
                  label={t("library.toolbar.searchClear")}
                  variant="ghost"
                  tooltip={null}
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-1 -translate-y-1/2 p-0.5"
                >
                  <X size={12} strokeWidth={2} />
                </IconButton>
              ) : null}
            </div>
          </div>
          <Select
            label={t("library.toolbar.sortLabel")}
            value={sort}
            onChange={setSort}
            options={LIBRARY_SORT_ORDERS.map((order) => ({
              value: order,
              label: t(librarySortLabelKey(order)),
            }))}
          />
          <Select
            label={t("library.toolbar.filterLabel")}
            value={extension}
            onChange={setExtension}
            options={[
              { value: LIBRARY_FILTER_ALL, label: t("library.toolbar.filterAll") },
              ...extensions.map((ext) => ({ value: ext, label: ext.toUpperCase() })),
            ]}
          />
        </div>
      ) : null}

      {selected.size > 0 ? (
        <HudPanel accent="green">
          {/* `items-end`, not `items-center`: the Preset `Select` carries a label above its trigger, so
              only bottom-aligning puts that trigger, the Convert button and the left-hand controls on one
              line — otherwise the labelled control sits lower than the label-less button next to it (owner
              feedback). The label floats above; every interactive control shares one baseline. */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 self-center">
                <span className="text-fg text-sm">
                  {t("library.selectCount", { count: selected.size })}
                </span>
                <Button variant="ghost" onClick={clearSelection}>
                  {t("library.selectClear")}
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  variant="ghost"
                  onClick={handleBulkCheck}
                  disabled={bulkCheck.running}
                  className="px-3 py-1.5 text-xs"
                >
                  {t("integrity.bulkCheck")}
                </Button>
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
                  className="px-4 py-1.5 text-xs"
                >
                  {t("library.selectConvert")}
                </Button>
              </div>
            </div>

            {/* Bulk deep-check progress, then the verdict + a one-click repair of the defective ones. */}
            {bulkCheck.running || bulkCheck.total > 0 ? (
              <div className="border-elevated flex flex-wrap items-center gap-3 border-t pt-2 text-xs">
                {bulkCheck.running ? (
                  <>
                    <span className="text-dim flex items-center gap-1.5">
                      <Loader2 size={12} strokeWidth={2} className="animate-spin" aria-hidden />
                      {t("integrity.bulkProgress", {
                        done: bulkCheck.done,
                        total: bulkCheck.total,
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      onClick={bulkCheck.cancel}
                      className="px-2 py-0.5 text-xs"
                    >
                      {t("common.cancel")}
                    </Button>
                  </>
                ) : bulkCheck.defective.length > 0 ? (
                  <>
                    <span className="text-danger flex items-center gap-1.5">
                      <AlertTriangle size={13} strokeWidth={2} aria-hidden />
                      {t("integrity.bulkDefective", {
                        count: bulkCheck.defective.length,
                        total: bulkCheck.total,
                      })}
                    </span>
                    <Button
                      accent="gold"
                      onClick={handleRepairDefective}
                      disabled={enqueueJob.isPending}
                      className="px-3 py-1 text-xs"
                    >
                      {t("integrity.repairDefective", { count: bulkCheck.defective.length })}
                    </Button>
                  </>
                ) : (
                  <span className="text-green flex items-center gap-1.5">
                    <CheckCircle2 size={13} strokeWidth={2} aria-hidden />
                    {t("integrity.bulkAllHealthy", { total: bulkCheck.total })}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </HudPanel>
      ) : null}

      {scan.data && scan.data.length > 0 && filteredFiles.length === 0 ? (
        <HudPanel accent="gold">
          <p className="text-dim text-sm">{t("library.noMatches")}</p>
        </HudPanel>
      ) : null}

      {filteredFiles.length > 0 ? (
        // Equal-width columns (`minmax(220px,1fr)`) are enough here: every `VideoCard` already reserves
        // a fixed title/metadata height and fills its own grid cell via an internal `h-full` chain
        // (see that component's doc comment), so every card's natural size is identical regardless of
        // its row — no `grid-auto-rows`/stretch override is needed on top of that (owner feedback:
        // cards must all be the same size).
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {filteredFiles.map((file) => (
            <VideoCard
              key={file.path}
              file={file}
              onSelect={handleCardSelect}
              onToggleSelect={toggleSelected}
              selected={selected.has(file.path)}
              anySelected={selected.size > 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
