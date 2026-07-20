//! Folder-browser commands (ADR-PROJ-001, rule:media-pipeline): the read-only filesystem listing that
//! backs the in-app HUD folder browser, replacing the OS-native picker (owner decision). Both are
//! read-only — a list of directory *names*, never file contents, never a write. The folder the user
//! finally chooses is still validated by `scan_folder` before any media work runs (trust boundary,
//! rule:security).

use crate::dto::{DirEntry, FsRoot, RootKind};
use crate::error::Result;
use std::path::PathBuf;
use tauri::Manager;

/// The browser's starting points: the standard user directories that resolve on this OS (Home, Desktop,
/// Downloads, Documents, Videos) followed by every mounted drive/volume. A standard dir that the platform
/// can't resolve, or that doesn't exist, is simply omitted — never an error.
#[tauri::command]
pub fn browse_roots(app: tauri::AppHandle) -> Result<Vec<FsRoot>> {
    tracing::debug!("browse_roots");
    let p = app.path();
    let mut roots: Vec<FsRoot> = [
        std_root(p.home_dir(), RootKind::Home),
        std_root(p.desktop_dir(), RootKind::Desktop),
        std_root(p.download_dir(), RootKind::Downloads),
        std_root(p.document_dir(), RootKind::Documents),
        std_root(p.video_dir(), RootKind::Videos),
    ]
    .into_iter()
    .flatten()
    .collect();
    for d in crate::browse::drives() {
        roots.push(FsRoot {
            label: crate::browse::drive_label(&d),
            path: d.to_string_lossy().into_owned(),
            kind: RootKind::Drive,
        });
    }
    tracing::debug!(count = roots.len(), "browse_roots done");
    Ok(roots)
}

/// Build a standard-directory root from a resolver result, or `None` if it didn't resolve / isn't a real
/// directory. The `label` is the folder's own name (a fallback); the frontend translates by `kind`.
fn std_root(dir: std::result::Result<PathBuf, tauri::Error>, kind: RootKind) -> Option<FsRoot> {
    let path = dir.ok()?;
    if !path.is_dir() {
        return None;
    }
    let label = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    Some(FsRoot {
        label,
        path: path.to_string_lossy().into_owned(),
        kind,
    })
}

/// The immediate sub**folders** of `path`, for the browser's content pane / tree expansion. A path that
/// can't be opened (missing, denied, not a folder) is a typed error the UI shows in place; entries that
/// can't be read individually are skipped (see `browse::list_subdirs`).
#[tauri::command]
pub fn browse_dir(path: String) -> Result<Vec<DirEntry>> {
    tracing::debug!(%path, "browse_dir");
    crate::browse::list_subdirs(&PathBuf::from(&path))
}
