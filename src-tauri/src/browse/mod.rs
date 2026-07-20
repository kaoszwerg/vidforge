//! Filesystem browsing for the in-app HUD folder browser (ADR-PROJ-001, rule:media-pipeline).
//!
//! The app picks a *folder* to scan with its own HUD browser instead of the OS-native dialog (owner
//! decision), so this module answers exactly two read-only questions: "what are the starting points
//! (drives + standard dirs)?" and "what sub**folders** does this folder have?". It never lists files,
//! never reads file *contents*, and never writes anything — a directory listing, nothing more. A folder
//! the user then chooses is still re-validated by `scan_folder` before any media work touches it.

use crate::dto::DirEntry;
use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};

/// The immediate sub**directories** of `dir`, sorted case-insensitively by name — the folder browser's
/// content pane. Read-only and permission-tolerant: an entry whose metadata can't be read (a broken
/// symlink, a denied ACL) is skipped rather than failing the whole listing, but a `dir` that can't be
/// opened at all is a typed error so the UI can say "can't open this folder" instead of showing nothing.
/// Dotfiles are hidden. Symlinks are followed (a link to a folder lists as a folder).
pub fn list_subdirs(dir: &Path) -> Result<Vec<DirEntry>> {
    let read = std::fs::read_dir(dir).map_err(|e| AppError::io(dir.display().to_string(), e))?;
    let mut out: Vec<DirEntry> = Vec::new();
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue; // hidden (Unix convention); keeps "." noise out of the list
        }
        // `metadata()` follows symlinks (unlike `file_type()`), so a symlinked folder shows as a folder;
        // an entry we can't stat (permission/broken link) is skipped, not fatal.
        match std::fs::metadata(entry.path()) {
            Ok(meta) if meta.is_dir() => out.push(DirEntry {
                name,
                path: entry.path().to_string_lossy().to_string(),
            }),
            _ => continue,
        }
    }
    out.sort_by_key(|e| e.name.to_lowercase());
    Ok(out)
}

/// The mounted drives/volumes to offer as browser roots. Windows: every existing `A:\`..`Z:\`. Unix: the
/// filesystem root `/` (individual mounts appear as subfolders under `/` and `/mnt`/`/media`, so a single
/// root is enough and avoids parsing `/proc/mounts`).
pub fn drives() -> Vec<PathBuf> {
    #[cfg(windows)]
    {
        (b'A'..=b'Z')
            .map(|c| PathBuf::from(format!("{}:\\", c as char)))
            .filter(|p| p.exists())
            .collect()
    }
    #[cfg(not(windows))]
    {
        vec![PathBuf::from("/")]
    }
}

/// A drive's display label — the path itself reads fine (`C:\`, `/`), so no OS volume-label lookup.
pub fn drive_label(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_only_visible_subdirs_sorted() {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        std::fs::create_dir(root.join("Zeta")).unwrap();
        std::fs::create_dir(root.join("alpha")).unwrap();
        std::fs::create_dir(root.join(".hidden")).unwrap();
        std::fs::write(root.join("a-file.txt"), b"x").unwrap();

        let subs = list_subdirs(root).expect("list");
        let names: Vec<&str> = subs.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["alpha", "Zeta"], "sorted, no file, no dotfile");
        assert!(
            subs[0].path.ends_with("alpha"),
            "path is the absolute child path"
        );
    }

    #[test]
    fn listing_a_missing_dir_is_a_typed_error_not_a_panic() {
        let dir = tempfile::tempdir().expect("tempdir");
        let missing = dir.path().join("does-not-exist");
        assert!(list_subdirs(&missing).is_err());
    }

    #[test]
    fn drives_are_non_empty_and_exist() {
        let ds = drives();
        assert!(!ds.is_empty(), "there is always at least one drive/root");
        assert!(ds.iter().all(|p| p.exists()), "every listed drive exists");
    }
}
