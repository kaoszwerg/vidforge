import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { ReactNode } from "react";
import { useInstallFfmpeg } from "./useInstallFfmpeg";
import type { InstallProgress } from "../bindings/InstallProgress";
import type { FfmpegStatus } from "../bindings/FfmpegStatus";

vi.mock("../api/commands", () => ({
  api: { installFfmpeg: vi.fn() },
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import { api } from "../api/commands";
import { listen } from "@tauri-apps/api/event";

const mockListen = listen as unknown as Mock;

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function progress(overrides: Partial<InstallProgress> = {}): InstallProgress {
  return { phase: "download", percent: 10, message: null, ...overrides };
}

const readyStatus: FfmpegStatus = {
  ffmpeg: { path: "/opt/vidforge/ffmpeg", version: "6.1.1", source: "managed" },
  ffprobe: { path: "/opt/vidforge/ffprobe", version: "6.1.1", source: "managed" },
  ready: true,
};

describe("useInstallFfmpeg", () => {
  let handler: ((e: { event: string; id: number; payload: InstallProgress }) => void) | undefined;

  beforeEach(() => {
    handler = undefined;
    vi.mocked(api.installFfmpeg).mockReset();
    mockListen.mockReset();
    mockListen.mockImplementation(
      (
        _event: string,
        cb: (e: { event: string; id: number; payload: InstallProgress }) => void,
      ) => {
        handler = cb;
        return Promise.resolve(() => undefined);
      },
    );
  });

  it("starts with no progress, not installing and no error", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useInstallFfmpeg(), { wrapper: makeWrapper(qc) });

    expect(result.current.progress).toBeNull();
    expect(result.current.isInstalling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("subscribes to install://progress and mirrors the latest event while installing", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolveInstall: (v: FfmpegStatus) => void = () => undefined;
    vi.mocked(api.installFfmpeg).mockReturnValue(
      new Promise((resolve) => {
        resolveInstall = resolve;
      }),
    );

    const { result } = renderHook(() => useInstallFfmpeg(), { wrapper: makeWrapper(qc) });
    await waitFor(() =>
      expect(listen).toHaveBeenCalledWith("install://progress", expect.any(Function)),
    );

    act(() => result.current.install());
    await waitFor(() => expect(result.current.isInstalling).toBe(true));

    act(() =>
      handler?.({
        event: "install://progress",
        id: 1,
        payload: progress({ phase: "download", percent: 40 }),
      }),
    );
    await waitFor(() =>
      expect(result.current.progress).toEqual(progress({ phase: "download", percent: 40 })),
    );

    act(() =>
      handler?.({
        event: "install://progress",
        id: 2,
        payload: progress({ phase: "extract", percent: -1 }),
      }),
    );
    await waitFor(() =>
      expect(result.current.progress).toEqual(progress({ phase: "extract", percent: -1 })),
    );

    act(() => resolveInstall(readyStatus));
    await waitFor(() => expect(result.current.isInstalling).toBe(false));
  });

  it("invalidates the ffmpeg query once install_ffmpeg resolves", async () => {
    vi.mocked(api.installFfmpeg).mockResolvedValue(readyStatus);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useInstallFfmpeg(), { wrapper: makeWrapper(qc) });
    act(() => result.current.install());

    await waitFor(() => expect(result.current.isInstalling).toBe(false));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["ffmpeg"] });
  });

  it("exposes a rejected install as error and stops installing", async () => {
    vi.mocked(api.installFfmpeg).mockRejectedValue(
      "install ffmpeg manually (e.g. `brew install ffmpeg`)",
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useInstallFfmpeg(), { wrapper: makeWrapper(qc) });
    act(() => result.current.install());

    await waitFor(() => expect(result.current.isInstalling).toBe(false));
    expect(result.current.error).toBe("install ffmpeg manually (e.g. `brew install ffmpeg`)");
  });

  it("resets stale progress from a previous attempt when a new install starts", async () => {
    vi.mocked(api.installFfmpeg).mockResolvedValueOnce(readyStatus);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useInstallFfmpeg(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(handler).toBeDefined());

    act(() => result.current.install());
    act(() =>
      handler?.({
        event: "install://progress",
        id: 1,
        payload: progress({ phase: "extract", percent: 90 }),
      }),
    );
    await waitFor(() => expect(result.current.progress?.phase).toBe("extract"));
    await waitFor(() => expect(result.current.isInstalling).toBe(false));

    vi.mocked(api.installFfmpeg).mockReturnValue(new Promise(() => {}));
    act(() => result.current.install());

    await waitFor(() => expect(result.current.progress).toBeNull());
  });
});
