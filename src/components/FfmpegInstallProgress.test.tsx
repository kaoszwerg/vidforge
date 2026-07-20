import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FfmpegInstallProgress, type FfmpegInstallProgressProps } from "./FfmpegInstallProgress";
import { translate } from "../i18n";
import type { UseInstallFfmpegResult } from "../hooks/useInstallFfmpeg";

// A real (not mocked) translator bound to German — this component takes `t` as a plain prop, so no
// settings/query context is needed to exercise it in isolation.
const t: FfmpegInstallProgressProps["t"] = (key, params) => translate("de", key, params);

function install(overrides: Partial<UseInstallFfmpegResult> = {}): UseInstallFfmpegResult {
  return {
    install: vi.fn(),
    progress: null,
    isInstalling: false,
    error: null,
    ...overrides,
  };
}

// `installPhaseLabelKey` itself (the phase → i18n-key mapping, including the unrecognised-phase
// fallback) is unit-tested with the rest of `src/lib/` in `installPhase.test.ts`; the tests below only
// need to see its output through the rendered phase label.
describe("FfmpegInstallProgress", () => {
  it("calls install() when the button is clicked", () => {
    const state = install();
    render(<FfmpegInstallProgress installFfmpeg={state} t={t} />);

    fireEvent.click(screen.getByRole("button", { name: "ffmpeg installieren" }));

    expect(state.install).toHaveBeenCalledOnce();
  });

  it("disables the button while installing", () => {
    render(<FfmpegInstallProgress installFfmpeg={install({ isInstalling: true })} t={t} />);
    expect(screen.getByRole("button", { name: "ffmpeg installieren" })).toBeDisabled();
  });

  it("shows the phase label and percent while installing", () => {
    render(
      <FfmpegInstallProgress
        installFfmpeg={install({
          isInstalling: true,
          progress: { phase: "download", percent: 30, message: null },
        })}
        t={t}
      />,
    );

    expect(screen.getByText("Lade herunter…")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
  });

  it("shows an indeterminate progress bar when percent is -1", () => {
    render(
      <FfmpegInstallProgress
        installFfmpeg={install({
          isInstalling: true,
          progress: { phase: "extract", percent: -1, message: null },
        })}
        t={t}
      />,
    );

    expect(screen.getByText("Entpacke…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("replaces the progress row with the backend detail on a phase: error event", () => {
    render(
      <FfmpegInstallProgress
        installFfmpeg={install({
          isInstalling: true,
          progress: { phase: "error", percent: -1, message: "SHA-256 mismatch" },
        })}
        t={t}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Installation fehlgeschlagen. SHA-256 mismatch",
    );
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows a rejected install's error message", () => {
    render(
      <FfmpegInstallProgress
        installFfmpeg={install({ error: "install ffmpeg manually (e.g. `brew install ffmpeg`)" })}
        t={t}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Installation fehlgeschlagen. install ffmpeg manually (e.g. `brew install ffmpeg`)",
    );
  });

  it("shows no progress row or failure message while idle", () => {
    render(<FfmpegInstallProgress installFfmpeg={install()} t={t} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
