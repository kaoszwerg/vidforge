import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "./commands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const mockInvoke = invoke as unknown as Mock;
const mockOpen = open as unknown as Mock;

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

  describe("scanFolder", () => {
    it("calls scan_folder with the path and a null recursive when omitted", async () => {
      const files = [{ path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 100 }];
      mockInvoke.mockResolvedValue(files);
      await expect(api.scanFolder("/videos")).resolves.toEqual(files);
      expect(mockInvoke).toHaveBeenCalledWith("scan_folder", { path: "/videos", recursive: null });
    });

    it("forwards an explicit recursive override", async () => {
      mockInvoke.mockResolvedValue([]);
      await api.scanFolder("/videos", true);
      expect(mockInvoke).toHaveBeenCalledWith("scan_folder", { path: "/videos", recursive: true });
    });
  });

  it("probeMedia calls probe_media with the path", async () => {
    const info = { path: "/videos/a.mp4", container: "MP4", duration_secs: 12.5, size_bytes: 100 };
    mockInvoke.mockResolvedValue(info);
    await expect(api.probeMedia("/videos/a.mp4")).resolves.toEqual(info);
    expect(mockInvoke).toHaveBeenCalledWith("probe_media", { path: "/videos/a.mp4" });
  });

  it("preparePlayer calls prepare_player with the path", async () => {
    const prepared = { file_path: "/cache/vidforge/abc123.mp4", transcoded: true };
    mockInvoke.mockResolvedValue(prepared);
    await expect(api.preparePlayer("/videos/a.mkv")).resolves.toEqual(prepared);
    expect(mockInvoke).toHaveBeenCalledWith("prepare_player", { path: "/videos/a.mkv" });
  });

  it("getThumbnail calls get_thumbnail with the path", async () => {
    mockInvoke.mockResolvedValue("data:image/jpeg;base64,abc");
    await expect(api.getThumbnail("/videos/a.mp4")).resolves.toBe("data:image/jpeg;base64,abc");
    expect(mockInvoke).toHaveBeenCalledWith("get_thumbnail", { path: "/videos/a.mp4" });
  });

  describe("pickFolder", () => {
    beforeEach(() => {
      mockOpen.mockReset();
    });

    it("opens a directory-only dialog and resolves to the chosen path", async () => {
      mockOpen.mockResolvedValue("/home/user/videos");
      await expect(api.pickFolder()).resolves.toBe("/home/user/videos");
      expect(mockOpen).toHaveBeenCalledWith({ directory: true });
    });

    it("resolves to null when the user cancels", async () => {
      mockOpen.mockResolvedValue(null);
      await expect(api.pickFolder()).resolves.toBeNull();
    });
  });

  it("listPresets calls list_presets with no args", async () => {
    const presets = [{ id: "universal", container: "mp4", reencodes: true }];
    mockInvoke.mockResolvedValue(presets);
    await expect(api.listPresets()).resolves.toEqual(presets);
    expect(mockInvoke).toHaveBeenCalledWith("list_presets");
  });

  describe("enqueueJob", () => {
    const job = {
      id: "job-1",
      input_path: "/videos/a.mp4",
      input_name: "a.mp4",
      output_path: "/videos/vidforge-out/a.mp4",
      preset_id: "universal",
      state: "Queued",
      percent: 0,
      error: null,
    };

    it("sends a null custom when omitted", async () => {
      mockInvoke.mockResolvedValue(job);
      await expect(api.enqueueJob("/videos/a.mp4", "universal")).resolves.toEqual(job);
      expect(mockInvoke).toHaveBeenCalledWith("enqueue_job", {
        inputPath: "/videos/a.mp4",
        presetId: "universal",
        custom: null,
      });
    });

    it("forwards an explicit custom encode", async () => {
      const custom = {
        container: "mkv",
        video_codec: "hevc",
        crf: 20,
        audio_codec: "opus",
        audio_bitrate_k: 160,
      };
      mockInvoke.mockResolvedValue(job);
      await api.enqueueJob("/videos/a.mp4", "custom", custom);
      expect(mockInvoke).toHaveBeenCalledWith("enqueue_job", {
        inputPath: "/videos/a.mp4",
        presetId: "custom",
        custom,
      });
    });
  });

  it("cancelJob calls cancel_job with the id", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await api.cancelJob("job-1");
    expect(mockInvoke).toHaveBeenCalledWith("cancel_job", { id: "job-1" });
  });

  it("listJobs calls list_jobs with no args", async () => {
    mockInvoke.mockResolvedValue([]);
    await expect(api.listJobs()).resolves.toEqual([]);
    expect(mockInvoke).toHaveBeenCalledWith("list_jobs");
  });

  it("installFfmpeg calls install_ffmpeg with no args", async () => {
    const status = {
      ffmpeg: { path: "/opt/vidforge/ffmpeg", version: "6.1.1", source: "managed" },
      ffprobe: { path: "/opt/vidforge/ffprobe", version: "6.1.1", source: "managed" },
      ready: true,
    };
    mockInvoke.mockResolvedValue(status);
    await expect(api.installFfmpeg()).resolves.toEqual(status);
    expect(mockInvoke).toHaveBeenCalledWith("install_ffmpeg");
  });
});
