// Library/Detail selection state (Zustand): the chosen folder and the video selected for the Detail
// view (ADR-PROJ-001). Cross-component client UI state, not server data — TanStack Query owns the
// scan/probe/thumbnail results themselves (rule:frontend-architecture); this store only tracks which
// folder and which video the user is looking at.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LibraryState {
  /** Folder the user last picked or dropped, or `null` before any folder has been chosen. Persisted
   * so relaunching the app re-scans the same folder instead of starting from an empty Dropzone. */
  folder: string | null;
  /** Absolute path of the video shown in the Detail view, or `null` when none is selected (the grid
   * is shown instead). Not persisted: a selection surviving a relaunch would either point at a file
   * that moved since, or force a probe before the grid has even rendered. */
  selectedPath: string | null;
  /** Bulk multiselect for the Library grid's action bar (absolute paths). Not persisted — same reasoning
   * as `selectedPath`: a selection surviving a relaunch could point at files that moved, or a folder
   * that has not even been re-scanned yet. */
  selected: Set<string>;
  /** Anchor for Shift-click range selection: the path most recently touched by a plain or Ctrl/Cmd
   * click. `null` once cleared or a new folder is chosen. */
  lastClickedPath: string | null;

  /** Choose a folder. Clears any video selection and the bulk selection — both belong to the previous
   * folder's grid, which no longer exists once the folder (and therefore the scan results) changes. */
  setFolder: (folder: string | null) => void;
  /** Select a video for the Detail view, or `null` to return to the grid. */
  selectVideo: (path: string | null) => void;
  /** Plain click (VideoCard, ADR-PROJ-001): replace the bulk selection with exactly this path and set
   * it as the new Shift-click range anchor. */
  selectOnly: (path: string) => void;
  /** Ctrl/Cmd-click: toggle this path's membership without disturbing the rest of the selection. */
  toggleSelected: (path: string) => void;
  /** Shift-click range / Ctrl+A select-all: replace the selection with an explicit list of paths — the
   * store has no notion of grid order, so the caller (LibraryView, which has the scanned file list)
   * computes the range or the full set. */
  setSelectedPaths: (paths: string[]) => void;
  /** Escape, or after a bulk action has been dispatched. */
  clearSelection: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      folder: null,
      selectedPath: null,
      selected: new Set<string>(),
      lastClickedPath: null,

      setFolder: (folder) =>
        set({ folder, selectedPath: null, selected: new Set(), lastClickedPath: null }),
      selectVideo: (selectedPath) => set({ selectedPath }),

      selectOnly: (path) => set({ selected: new Set([path]), lastClickedPath: path }),
      toggleSelected: (path) =>
        set((s) => {
          const next = new Set(s.selected);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return { selected: next, lastClickedPath: path };
        }),
      setSelectedPaths: (paths) => set({ selected: new Set(paths) }),
      clearSelection: () => set({ selected: new Set(), lastClickedPath: null }),
    }),
    {
      name: "app-library",
      // Schema version for the Zustand-persist middleware (NOT the app version — see store/ui.ts for
      // the same convention). Bump whenever the `partialize` shape changes.
      // 1: { folder }
      version: 1,
      partialize: (s) => ({ folder: s.folder }),
    },
  ),
);
