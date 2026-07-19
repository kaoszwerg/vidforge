//! Job commands (ADR-PROJ-001 §4): list presets, enqueue a conversion/repair, cancel, list jobs.

use crate::dto::{CustomEncode, JobDto, PresetDto};
use crate::error::{AppError, Result};
use crate::jobs::preset;
use crate::jobs::queue::JobQueue;
use crate::state::AppState;
use std::path::{Path, PathBuf};
use tauri::State;

/// The available presets (id + container + whether it re-encodes). Labels are localized frontend-side.
#[tauri::command]
pub fn list_presets() -> Vec<PresetDto> {
    tracing::debug!("list_presets");
    preset::all_presets()
}

/// Queue a conversion/repair of one file. Output is strictly non-destructive (a separate output dir).
#[tauri::command]
pub fn enqueue_job(
    state: State<'_, AppState>,
    queue: State<'_, JobQueue>,
    input_path: String,
    preset_id: String,
    custom: Option<CustomEncode>,
) -> Result<JobDto> {
    tracing::info!(%input_path, %preset_id, "enqueue_job");
    let input = PathBuf::from(&input_path);
    if !input.is_file() {
        return Err(AppError::Other(format!("not a file: {input_path}")));
    }
    if !preset::all_presets().iter().any(|p| p.id == preset_id) {
        return Err(AppError::Other(format!("unknown preset: {preset_id}")));
    }
    let out_dir = output_dir_for(&state, &input);
    Ok(queue.enqueue(input_path, preset_id, custom, &out_dir))
}

/// Request cancellation of a job by id.
#[tauri::command]
pub fn cancel_job(queue: State<'_, JobQueue>, id: String) {
    tracing::info!(%id, "cancel_job");
    queue.cancel(&id);
}

/// A snapshot of all jobs (queued, running, finished), in enqueue order.
#[tauri::command]
pub fn list_jobs(queue: State<'_, JobQueue>) -> Vec<JobDto> {
    queue.list()
}

/// The output directory for a job — the configured `output_dir`, else a `vidforge-out` folder beside the
/// source. Never the source's own path (the source is never overwritten, ADR-PROJ-001).
fn output_dir_for(state: &AppState, input: &Path) -> PathBuf {
    if let Some(dir) = state.settings.get().output_dir {
        return PathBuf::from(dir);
    }
    input
        .parent()
        .map(|p| p.join("vidforge-out"))
        .unwrap_or_else(|| PathBuf::from("vidforge-out"))
}
