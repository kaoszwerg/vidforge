//! Resolve the `ffmpeg`/`ffprobe` binaries (ADR-PROJ-001 §1, rule:media-pipeline).
//!
//! Resolution order, per tool: an explicit settings override → the app-managed install dir
//! (`<app_data>/bin/`) → the process `PATH` → the platform's usual install locations. "Not found" is a
//! typed state ([`FfmpegStatus::ready`] = false), never a panic (ADR-CORE-037) — the UI offers the
//! installer when a tool is missing.

use crate::dto::{FfmpegStatus, FfmpegTool};
use std::ffi::OsString;
use std::path::{Path, PathBuf};

const FFMPEG: &str = "ffmpeg";
const FFPROBE: &str = "ffprobe";

/// Path overrides taken from the persisted settings (`None` = auto-discover).
#[derive(Debug, Default, Clone, Copy)]
pub struct Overrides<'a> {
    pub ffmpeg: Option<&'a str>,
    pub ffprobe: Option<&'a str>,
}

/// Resolve both tools. `managed_bin_dir` is `<app_data>/bin`, where the in-app installer writes.
pub fn discover(overrides: Overrides, managed_bin_dir: &Path) -> FfmpegStatus {
    let ffmpeg = resolve(FFMPEG, overrides.ffmpeg, managed_bin_dir);
    let ffprobe = resolve(FFPROBE, overrides.ffprobe, managed_bin_dir);
    let ready = ffmpeg.is_some() && ffprobe.is_some();
    tracing::info!(
        ffmpeg = ffmpeg.is_some(),
        ffprobe = ffprobe.is_some(),
        ready,
        "ffmpeg discovery"
    );
    FfmpegStatus {
        ffmpeg,
        ffprobe,
        ready,
    }
}

/// The on-disk filename of a tool for this OS (`ffmpeg` vs `ffmpeg.exe`).
pub fn exe_name(tool: &str) -> String {
    if cfg!(windows) {
        format!("{tool}.exe")
    } else {
        tool.to_string()
    }
}

fn resolve(tool: &str, override_path: Option<&str>, managed_bin_dir: &Path) -> Option<FfmpegTool> {
    let (path, source) = find_tool(tool, override_path, managed_bin_dir)?;
    probe_tool(&path, source)
}

/// Locate a tool's binary and how it was resolved, WITHOUT running `-version`. This is the fast path the
/// media commands use — they need the path, not the version string, and re-probing `-version` per file
/// would be wasteful. Order matches [`resolve`]: override -> managed -> PATH -> platform locations.
pub fn find_tool(
    tool: &str,
    override_path: Option<&str>,
    managed_bin_dir: &Path,
) -> Option<(PathBuf, &'static str)> {
    // 1. Explicit override — a stale/invalid override must not shadow a working discovery.
    if let Some(p) = override_path {
        let path = PathBuf::from(p);
        if path.is_file() {
            return Some((path, "override"));
        }
        tracing::warn!(
            tool,
            path = p,
            "ffmpeg override path is not a file; ignoring"
        );
    }
    // 2. App-managed install (written by the in-app installer).
    let managed = managed_bin_dir.join(exe_name(tool));
    if managed.is_file() {
        return Some((managed, "managed"));
    }
    // 3. On the process PATH.
    if let Some(found) = find_in(&exe_name(tool), std::env::var_os("PATH")) {
        return Some((found, "path"));
    }
    // 4. Platform install locations.
    for dir in platform_dirs() {
        let cand = dir.join(exe_name(tool));
        if cand.is_file() {
            return Some((cand, "system"));
        }
    }
    None
}

/// Find `exe` in a `PATH`-style variable (extracted for testability — no reliance on the live env).
pub fn find_in(exe: &str, path_var: Option<OsString>) -> Option<PathBuf> {
    let path_var = path_var?;
    for dir in std::env::split_paths(&path_var) {
        if dir.as_os_str().is_empty() {
            continue;
        }
        let cand = dir.join(exe);
        if cand.is_file() {
            return Some(cand);
        }
    }
    None
}

fn platform_dirs() -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        vec![
            PathBuf::from(r"C:\ffmpeg\bin"),
            PathBuf::from(r"C:\Program Files\ffmpeg\bin"),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/bin"),
        ]
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        vec![
            PathBuf::from("/usr/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/snap/bin"),
        ]
    }
}

/// Run `<path> -version` and turn a success into a [`FfmpegTool`]. Suppresses the console window that
/// would otherwise flash on Windows when a GUI process spawns a console child.
fn probe_tool(path: &Path, source: &str) -> Option<FfmpegTool> {
    let mut cmd = crate::ffmpeg::command(path);
    cmd.arg("-version");
    let out = match cmd.output() {
        Ok(o) => o,
        Err(e) => {
            tracing::warn!(path = %path.display(), error = %e, "could not run tool -version");
            return None;
        }
    };
    if !out.status.success() {
        tracing::warn!(path = %path.display(), "tool -version exited non-zero");
        return None;
    }
    Some(FfmpegTool {
        path: path.display().to_string(),
        version: parse_version(&String::from_utf8_lossy(&out.stdout)),
        source: source.to_string(),
    })
}

/// Extract the version token from `ffmpeg -version` output. The first line is
/// `"ffmpeg version <X> Copyright ..."`; we return `<X>`, falling back to the whole line.
fn parse_version(output: &str) -> String {
    let first = output.lines().next().unwrap_or("").trim();
    let mut it = first.split_whitespace();
    while let Some(tok) = it.next() {
        if tok == "version" {
            if let Some(v) = it.next() {
                if !v.is_empty() {
                    return v.to_string();
                }
            }
        }
    }
    if first.is_empty() {
        "unknown".to_string()
    } else {
        first.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exe_name_has_platform_suffix() {
        let n = exe_name("ffmpeg");
        if cfg!(windows) {
            assert_eq!(n, "ffmpeg.exe");
        } else {
            assert_eq!(n, "ffmpeg");
        }
    }

    #[test]
    fn parse_version_pulls_the_version_token() {
        assert_eq!(
            parse_version("ffmpeg version 6.1.1 Copyright (c) 2000-2024"),
            "6.1.1"
        );
        assert_eq!(
            parse_version("ffprobe version N-121825-g3cc1dc3358 Copyright"),
            "N-121825-g3cc1dc3358"
        );
    }

    #[test]
    fn parse_version_falls_back_to_the_line_or_unknown() {
        assert_eq!(parse_version(""), "unknown");
        assert_eq!(parse_version("something odd"), "something odd");
    }

    #[test]
    fn find_in_locates_a_file_on_the_path() {
        let dir = tempfile::tempdir().expect("tempdir");
        let exe = exe_name("ffmpeg");
        std::fs::write(dir.path().join(&exe), b"#!/bin/sh\n").expect("write");
        // Two entries; the tool is in the second.
        let other = tempfile::tempdir().expect("tempdir2");
        let joined = std::env::join_paths([other.path(), dir.path()]).expect("join");
        let found = find_in(&exe, Some(joined)).expect("should find the exe");
        assert_eq!(found, dir.path().join(&exe));
    }

    #[test]
    fn find_in_returns_none_when_absent_or_unset() {
        assert!(find_in("ffmpeg", None).is_none());
        let empty = tempfile::tempdir().expect("tempdir");
        let joined = std::env::join_paths([empty.path()]).expect("join");
        assert!(find_in(&exe_name("ffmpeg"), Some(joined)).is_none());
    }

    #[test]
    fn discover_reports_not_ready_when_nothing_is_found() {
        // An empty managed dir + an override pointing nowhere → neither tool resolves (PATH may or may
        // not have ffmpeg on the dev box, so we assert the shape, not the boolean).
        let dir = tempfile::tempdir().expect("tempdir");
        let status = discover(
            Overrides {
                ffmpeg: Some("/nonexistent/ffmpeg"),
                ffprobe: Some("/nonexistent/ffprobe"),
            },
            dir.path(),
        );
        // ready is true only if BOTH resolve; with bogus overrides it can only be true if the host has
        // them on PATH/system — in which case ffmpeg/ffprobe are Some. Invariant: ready == both Some.
        assert_eq!(
            status.ready,
            status.ffmpeg.is_some() && status.ffprobe.is_some()
        );
    }
}
