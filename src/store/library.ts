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

  /** Choose a folder. Clears any video selection — a selection from the previous folder's grid has
   * no meaning once the folder (and therefore the scan results) changes. */
  setFolder: (folder: string | null) => void;
  /** Select a video for the Detail view, or `null` to return to the grid. */
  selectVideo: (path: string | null) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      folder: null,
      selectedPath: null,

      setFolder: (folder) => set({ folder, selectedPath: null }),
      selectVideo: (selectedPath) => set({ selectedPath }),
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
