//! ffmpeg orchestration (ADR-PROJ-001, rule:media-pipeline).
//!
//! Vidforge never links `libav*` — it shells out to the external `ffmpeg`/`ffprobe` binaries. This
//! module resolves those binaries (discovery), and installs them on request when the system has none
//! (the one deliberate, opt-in network egress).

pub mod discover;
pub mod install;

use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};
use tauri::Manager;

/// The directory the in-app installer writes the ffmpeg suite to, and that discovery checks before
/// `PATH`: `<app_data>/bin`.
pub fn managed_bin_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(format!("resolve app data dir: {e}")))?
        .join("bin");
    Ok(dir)
}

/// A `std::process::Command` for `program` that never flashes a console window on Windows (a GUI
/// process spawning a console child would otherwise pop one up). Shared by discovery, probing and
/// thumbnailing (rule:reusability); for async use, convert with `tokio::process::Command::from(..)`.
pub fn command(program: &Path) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    no_console_window(&mut cmd);
    cmd
}

#[cfg(windows)]
fn no_console_window(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW.
    cmd.creation_flags(0x0800_0000);
}

#[cfg(not(windows))]
fn no_console_window(_cmd: &mut std::process::Command) {}
