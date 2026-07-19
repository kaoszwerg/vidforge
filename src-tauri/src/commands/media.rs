//! Media commands (ADR-PROJ-001, rule:media-pipeline): scan a folder, probe one file, thumbnail one
//! file. Thin — resolve the tool, do the work, map the error. Each command acts only on a path the user
//! chose (a folder they picked, or a file that folder's scan produced).

use crate::dto::{MediaInfo, ScannedFile};
use crate::error::{AppError, Result};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

/// Thumbnail width in px (height keeps aspect). Small enough for a card grid, large enough to read.
const THUMB_WIDTH: u32 = 320;

/// Scan a folder for video files. `recursive` overrides the persisted `recursive_scan` setting when set.
#[tauri::command]
pub fn scan_folder(
    state: State<'_, AppState>,
    path: String,
    recursive: Option<bool>,
) -> Result<Vec<ScannedFile>> {
    tracing::info!(%path, ?recursive, "scan_folder");
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(AppError::Other(format!("not a folder: {path}")));
    }
    let rec = recursive.unwrap_or_else(|| state.settings.get().recursive_scan);
    let files = crate::media::scan::scan(&root, rec);
    tracing::info!(count = files.len(), "scan_folder done");
    Ok(files)
}

/// Read one file's technical metadata via ffprobe.
#[tauri::command]
pub async fn probe_media(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<MediaInfo> {
    tracing::debug!(%path, "probe_media");
    let ffprobe = resolve_tool(&app, &state, "ffprobe")?;
    crate::media::probe::probe(&ffprobe, &PathBuf::from(&path)).await
}

/// Return a `data:image/jpeg;base64,...` thumbnail for one file (generated + cached on first request).
#[tauri::command]
pub async fn get_thumbnail(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String> {
    tracing::debug!(%path, "get_thumbnail");
    let ffmpeg = resolve_tool(&app, &state, "ffmpeg")?;
    let cache_dir = crate::media::thumbs_cache_dir(&app)?;
    crate::media::thumbnail::thumbnail(&ffmpeg, &PathBuf::from(&path), &cache_dir, THUMB_WIDTH)
        .await
}

/// Resolve `tool` (`"ffmpeg"`/`"ffprobe"`) to a path via discovery (settings override → managed → PATH →
/// platform), or a typed [`AppError::FfmpegNotReady`] so the UI can offer the installer. Fast: no
/// `-version` call (see `discover::find_tool`).
fn resolve_tool(app: &tauri::AppHandle, state: &AppState, tool: &str) -> Result<PathBuf> {
    let settings = state.settings.get();
    let bin = crate::ffmpeg::managed_bin_dir(app)?;
    let override_path = if tool == "ffmpeg" {
        settings.ffmpeg_path.as_deref()
    } else {
        settings.ffprobe_path.as_deref()
    };
    crate::ffmpeg::discover::find_tool(tool, override_path, &bin)
        .map(|(p, _)| p)
        .ok_or(AppError::FfmpegNotReady)
}
