import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { api } from "./commands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = invoke as unknown as Mock;

describe("api", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("appVersion calls app_version with no args", async () => {
    mockInvoke.mockResolvedValue("0.1.0");
    await expect(api.appVersion()).resolves.toBe("0.1.0");
    expect(mockInvoke).toHaveBeenCalledWith("app_version");
  });

  it("buildInfo calls build_info with no args", async () => {
    const build = {
      version: "0.1.0",
      channel: "dev",
      debug: true,
      git_sha: "abc1234",
      git_dirty: false,
      commit_date: "2026-07-11T00:00:00Z",
    };
    mockInvoke.mockResolvedValue(build);
    await expect(api.buildInfo()).resolves.toEqual(build);
    expect(mockInvoke).toHaveBeenCalledWith("build_info");
  });

  it("getRecentLogs calls get_recent_logs with no args", async () => {
    mockInvoke.mockResolvedValue([]);
    await expect(api.getRecentLogs()).resolves.toEqual([]);
    expect(mockInvoke).toHaveBeenCalledWith("get_recent_logs");
  });

  it("getSettings calls get_settings with no args", async () => {
    const settings = { ui_scale: 1, minimize_to_tray: false };
    mockInvoke.mockResolvedValue(settings);
    await expect(api.getSettings()).resolves.toEqual(settings);
    expect(mockInvoke).toHaveBeenCalledWith("get_settings");
  });

  describe("updateSettings", () => {
    it("pins the payload shape: uiScale sent, every other field null", async () => {
      mockInvoke.mockResolvedValue({ ui_scale: 1.25, minimize_to_tray: false });
      await api.updateSettings({ uiScale: 1.25 });
      expect(mockInvoke).toHaveBeenCalledWith("update_settings", {
        uiScale: 1.25,
        minimizeToTray: null,
        language: null,
        ffmpegPath: null,
        ffprobePath: null,
        outputDir: null,
        jobConcurrency: null,
        recursiveScan: null,
      });
    });

    it("pins the payload shape: minimizeToTray sent, every other field null", async () => {
      mockInvoke.mockResolvedValue({ ui_scale: 1, minimize_to_tray: true });
      await api.updateSettings({ minimizeToTray: true });
      expect(mockInvoke).toHaveBeenCalledWith("update_settings", {
        uiScale: null,
        minimizeToTray: true,
        language: null,
        ffmpegPath: null,
        ffprobePath: null,
        outputDir: null,
        jobConcurrency: null,
        recursiveScan: null,
      });
    });

    it("sends every field as null when no options are given", async () => {
      mockInvoke.mockResolvedValue({ ui_scale: 1, minimize_to_tray: false });
      await api.updateSettings({});
      expect(mockInvoke).toHaveBeenCalledWith("update_settings", {
        uiScale: null,
        minimizeToTray: null,
        language: null,
        ffmpegPath: null,
        ffprobePath: null,
        outputDir: null,
        jobConcurrency: null,
        recursiveScan: null,
      });
    });

    it("sends every given field, nulling out the rest", async () => {
      mockInvoke.mockResolvedValue({ ui_scale: 0.8, minimize_to_tray: true });
      await api.updateSettings({
        uiScale: 0.8,
        minimizeToTray: true,
        language: "en",
        ffmpegPath: "/usr/bin/ffmpeg",
        ffprobePath: "/usr/bin/ffprobe",
        outputDir: "/home/user/videos-out",
        jobConcurrency: 4,
        recursiveScan: false,
      });
      expect(mockInvoke).toHaveBeenCalledWith("update_settings", {
        uiScale: 0.8,
        minimizeToTray: true,
        language: "en",
        ffmpegPath: "/usr/bin/ffmpeg",
        ffprobePath: "/usr/bin/ffprobe",
        outputDir: "/home/user/videos-out",
        jobConcurrency: 4,
        recursiveScan: false,
      });
    });
  });

  it("openExternal calls open_external with the url", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await api.openExternal("https://example.com");
    expect(mockInvoke).toHaveBeenCalledWith("open_external", { url: "https://example.com" });
  });

  it("discoverFfmpeg calls discover_ffmpeg with no args", async () => {
    const status = { ffmpeg: null, ffprobe: null, ready: false };
    mockInvoke.mockResolvedValue(status);
    await expect(api.discoverFfmpeg()).resolves.toEqual(status);
    expect(mockInvoke).toHaveBeenCalledWith("discover_ffmpeg");
  });
});
