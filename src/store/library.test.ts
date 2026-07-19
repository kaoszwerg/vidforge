import { beforeEach, describe, expect, it } from "vitest";
import { useLibraryStore } from "./library";

describe("useLibraryStore", () => {
  beforeEach(() => {
    useLibraryStore.setState({
      folder: null,
      selectedPath: null,
      selected: new Set(),
      lastClickedPath: null,
    });
    window.localStorage.clear();
  });

  it("setFolder chooses a folder", () => {
    useLibraryStore.getState().setFolder("/videos");
    expect(useLibraryStore.getState().folder).toBe("/videos");
  });

  it("setFolder clears any active video selection and the bulk selection", () => {
    useLibraryStore.setState({
      folder: "/videos",
      selectedPath: "/videos/a.mp4",
      selected: new Set(["/videos/a.mp4"]),
      lastClickedPath: "/videos/a.mp4",
    });

    useLibraryStore.getState().setFolder("/other");

    expect(useLibraryStore.getState().folder).toBe("/other");
    expect(useLibraryStore.getState().selectedPath).toBeNull();
    expect(useLibraryStore.getState().selected.size).toBe(0);
    expect(useLibraryStore.getState().lastClickedPath).toBeNull();
  });

  it("selectVideo selects and clears a video", () => {
    useLibraryStore.getState().selectVideo("/videos/a.mp4");
    expect(useLibraryStore.getState().selectedPath).toBe("/videos/a.mp4");

    useLibraryStore.getState().selectVideo(null);
    expect(useLibraryStore.getState().selectedPath).toBeNull();
  });

  it("selectOnly replaces the selection with a single path and sets the range anchor", () => {
    useLibraryStore.getState().setSelectedPaths(["/videos/a.mp4", "/videos/b.mp4"]);

    useLibraryStore.getState().selectOnly("/videos/c.mp4");

    expect(useLibraryStore.getState().selected).toEqual(new Set(["/videos/c.mp4"]));
    expect(useLibraryStore.getState().lastClickedPath).toBe("/videos/c.mp4");
  });

  it("toggleSelected adds an unselected path and removes a selected one", () => {
    useLibraryStore.getState().toggleSelected("/videos/a.mp4");
    expect(useLibraryStore.getState().selected).toEqual(new Set(["/videos/a.mp4"]));
    expect(useLibraryStore.getState().lastClickedPath).toBe("/videos/a.mp4");

    useLibraryStore.getState().toggleSelected("/videos/b.mp4");
    expect(useLibraryStore.getState().selected).toEqual(
      new Set(["/videos/a.mp4", "/videos/b.mp4"]),
    );

    useLibraryStore.getState().toggleSelected("/videos/a.mp4");
    expect(useLibraryStore.getState().selected).toEqual(new Set(["/videos/b.mp4"]));
  });

  it("setSelectedPaths replaces the whole selection (range / select-all)", () => {
    useLibraryStore.getState().toggleSelected("/videos/a.mp4");

    useLibraryStore.getState().setSelectedPaths(["/videos/b.mp4", "/videos/c.mp4"]);

    expect(useLibraryStore.getState().selected).toEqual(
      new Set(["/videos/b.mp4", "/videos/c.mp4"]),
    );
  });

  it("clearSelection empties the selection and the range anchor", () => {
    useLibraryStore.getState().selectOnly("/videos/a.mp4");

    useLibraryStore.getState().clearSelection();

    expect(useLibraryStore.getState().selected.size).toBe(0);
    expect(useLibraryStore.getState().lastClickedPath).toBeNull();
  });

  it("persists only the folder, not the video or bulk selection", async () => {
    useLibraryStore.getState().setFolder("/videos");
    useLibraryStore.getState().selectVideo("/videos/a.mp4");
    useLibraryStore.getState().selectOnly("/videos/a.mp4");

    await useLibraryStore.persist.rehydrate();

    const persisted = JSON.parse(window.localStorage.getItem("app-library") ?? "{}") as {
      state: {
        folder: string | null;
        selectedPath?: string | null;
        selected?: unknown;
        lastClickedPath?: unknown;
      };
    };
    expect(persisted.state.folder).toBe("/videos");
    expect(persisted.state.selectedPath).toBeUndefined();
    expect(persisted.state.selected).toBeUndefined();
    expect(persisted.state.lastClickedPath).toBeUndefined();
  });

  it("rehydrates a persisted folder", async () => {
    window.localStorage.setItem(
      "app-library",
      JSON.stringify({ state: { folder: "/videos" }, version: 1 }),
    );

    await useLibraryStore.persist.rehydrate();

    expect(useLibraryStore.getState().folder).toBe("/videos");
  });
});
