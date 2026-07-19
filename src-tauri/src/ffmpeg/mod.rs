//! ffmpeg orchestration (ADR-PROJ-001, rule:media-pipeline).
//!
//! Vidforge never links `libav*` — it shells out to the external `ffmpeg`/`ffprobe` binaries. This
//! module resolves those binaries (discovery), and installs them on request when the system has none
//! (the one deliberate, opt-in network egress).

pub mod discover;

use crate::error::{AppError, Result};
use std::path::PathBuf;
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
