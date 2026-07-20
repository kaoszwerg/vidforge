//! Self-cleaning caches (ADR-PROJ-001, owner request). The thumbnail and prepared-player cache dirs are
//! kept under a byte budget by evicting the least-recently-modified files first, so a long-lived install
//! never grows the cache without bound. Pruning runs at startup; it only ever touches the app's own
//! `<app_data>/cache/**`, never a source file (rule:media-pipeline). It does NOT re-generate anything —
//! a cache hit still avoids the ffmpeg work entirely; this only bounds how much stays on disk.

use std::path::Path;
use std::time::SystemTime;

/// Max bytes kept in the thumbnail cache (each thumbnail is a small JPEG, so this holds thousands).
pub const THUMBS_BUDGET: u64 = 128 * 1024 * 1024;
/// Max bytes kept in the prepared-player cache (remuxed/transcoded MP4s can be large).
pub const PLAYER_BUDGET: u64 = 2 * 1024 * 1024 * 1024;

/// Prune `dir` to at most `max_bytes`, deleting oldest-by-mtime files first. Best-effort and logged;
/// returns the number of bytes freed. A missing dir (nothing cached yet) is a no-op.
pub fn prune(dir: &Path, max_bytes: u64) -> u64 {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    let mut files: Vec<(std::path::PathBuf, u64, SystemTime)> = Vec::new();
    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else { continue };
        if !meta.is_file() {
            continue;
        }
        let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        files.push((entry.path(), meta.len(), mtime));
    }

    let total: u64 = files.iter().map(|(_, size, _)| *size).sum();
    if total <= max_bytes {
        return 0;
    }

    // Least-recently-modified first: those are evicted until we are back under budget.
    files.sort_by_key(|(_, _, mtime)| *mtime);
    let mut to_free = total - max_bytes;
    let mut freed = 0u64;
    for (path, size, _) in files {
        if to_free == 0 {
            break;
        }
        match std::fs::remove_file(&path) {
            Ok(()) => {
                freed += size;
                to_free = to_free.saturating_sub(size);
            }
            Err(e) => {
                tracing::warn!(path = %path.display(), error = %e, "cache prune: could not remove file")
            }
        }
    }
    tracing::info!(dir = %dir.display(), freed, total, max_bytes, "cache pruned");
    freed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_dir_and_under_budget_are_noops() {
        assert_eq!(prune(Path::new("__vidforge_no_such_cache__"), 100), 0);
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("a"), vec![0u8; 10]).expect("w");
        assert_eq!(prune(dir.path(), 1024), 0, "under budget frees nothing");
        assert!(dir.path().join("a").is_file());
    }

    #[test]
    fn over_budget_evicts_until_under_budget() {
        let dir = tempfile::tempdir().expect("tempdir");
        for (name, size) in [("a", 500usize), ("b", 500), ("c", 500)] {
            std::fs::write(dir.path().join(name), vec![0u8; size]).expect("w");
        }
        // 1500 bytes total, budget 1000 -> at least 500 must be freed.
        let freed = prune(dir.path(), 1000);
        assert!(freed >= 500, "freed {freed}");
        let remaining: u64 = std::fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter_map(|e| e.metadata().ok())
            .filter(|m| m.is_file())
            .map(|m| m.len())
            .sum();
        assert!(
            remaining <= 1000,
            "remaining {remaining} must be within budget"
        );
    }
}
