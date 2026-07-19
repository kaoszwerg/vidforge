//! Folder scanning (ADR-PROJ-001 §3). A stdlib recursive walk for known video extensions — no `walkdir`
//! dependency (the standard library does this reasonably, rule:dependencies). One unreadable entry is
//! logged and skipped; it never aborts the whole scan.

use crate::dto::ScannedFile;
use std::path::{Path, PathBuf};

/// Known video file extensions (lower-case, no dot).
pub const VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "mpg", "mpeg", "ts", "m2ts", "mts",
    "3gp", "ogv", "vob", "f4v", "divx", "asf", "mxf",
];

/// Whether `ext` (no dot, any case) is a recognised video extension.
pub fn is_video_extension(ext: &str) -> bool {
    let lower = ext.to_ascii_lowercase();
    VIDEO_EXTENSIONS.contains(&lower.as_str())
}

/// Walk `root` for video files. `recursive` descends into subfolders. Symlinks are not followed (loop
/// safety). Returns files sorted case-insensitively by name.
pub fn scan(root: &Path, recursive: bool) -> Vec<ScannedFile> {
    let mut out = Vec::new();
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(e) => {
                tracing::warn!(dir = %dir.display(), error = %e, "scan: cannot read directory; skipping");
                continue;
            }
        };
        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };
            let path = entry.path();
            if file_type.is_dir() {
                if recursive {
                    stack.push(path);
                }
            } else if file_type.is_file() {
                if let Some(sf) = to_scanned_file(&path) {
                    out.push(sf);
                }
            }
            // symlinks (file_type.is_symlink()) are intentionally skipped — loop safety.
        }
    }
    out.sort_by_key(|f| f.name.to_ascii_lowercase());
    tracing::info!(root = %root.display(), recursive, count = out.len(), "scan complete");
    out
}

fn to_scanned_file(path: &Path) -> Option<ScannedFile> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    if !is_video_extension(&ext) {
        return None;
    }
    let name = path.file_name()?.to_str()?.to_string();
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    Some(ScannedFile {
        path: path.display().to_string(),
        name,
        extension: ext,
        size_bytes: size as f64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_video_extensions_case_insensitively() {
        assert!(is_video_extension("mp4"));
        assert!(is_video_extension("MKV"));
        assert!(is_video_extension("AvI"));
        assert!(!is_video_extension("txt"));
        assert!(!is_video_extension("jpg"));
    }

    #[test]
    fn scan_filters_to_videos_and_honours_recursion() {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        std::fs::write(root.join("a.mp4"), b"x").expect("w");
        std::fs::write(root.join("b.mkv"), b"xx").expect("w");
        std::fs::write(root.join("notes.txt"), b"x").expect("w");
        let sub = root.join("sub");
        std::fs::create_dir(&sub).expect("mkdir");
        std::fs::write(sub.join("c.avi"), b"xxx").expect("w");

        let flat = scan(root, false);
        assert_eq!(flat.len(), 2, "non-recursive: only top-level videos");
        assert!(flat.iter().all(|f| f.extension != "txt"));

        let deep = scan(root, true);
        assert_eq!(deep.len(), 3, "recursive: includes sub/c.avi");
        // sorted case-insensitively by name: a, b, c
        assert_eq!(deep[0].name, "a.mp4");
        assert_eq!(deep[2].name, "c.avi");
        assert_eq!(deep[0].size_bytes, 1.0);
    }
}
