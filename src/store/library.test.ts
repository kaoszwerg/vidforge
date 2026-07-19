import { beforeEach, describe, expect, it } from "vitest";
import { useLibraryStore } from "./library";

describe("useLibraryStore", () => {
  beforeEach(() => {
    useLibraryStore.setState({ folder: null, selectedPath: null });
    window.localStorage.clear();
  });

  it("setFolder chooses a folder", () => {
    useLibraryStore.getState().setFolder("/videos");
    expect(useLibraryStore.getState().folder).toBe("/videos");
  });

  it("setFolder clears any active video selection", () => {
    useLibraryStore.setState({ folder: "/videos", selectedPath: "/videos/a.mp4" });

    useLibraryStore.getState().setFolder("/other");

    expect(useLibraryStore.getState().folder).toBe("/other");
    expect(useLibraryStore.getState().selectedPath).toBeNull();
  });

  it("selectVideo selects and clears a video", () => {
    useLibraryStore.getState().selectVideo("/videos/a.mp4");
    expect(useLibraryStore.getState().selectedPath).toBe("/videos/a.mp4");

    useLibraryStore.getState().selectVideo(null);
    expect(useLibraryStore.getState().selectedPath).toBeNull();
  });

  it("persists only the folder, not the video selection", async () => {
    useLibraryStore.getState().setFolder("/videos");
    useLibraryStore.getState().selectVideo("/videos/a.mp4");

    await useLibraryStore.persist.rehydrate();

    const persisted = JSON.parse(window.localStorage.getItem("app-library") ?? "{}") as {
      state: { folder: string | null; selectedPath?: string | null };
    };
    expect(persisted.state.folder).toBe("/videos");
    expect(persisted.state.selectedPath).toBeUndefined();
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
