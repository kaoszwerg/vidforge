//! In-app ffmpeg installer (ADR-PROJ-001 §2, rule:privacy) — the ONE deliberate network egress.
//!
//! User-initiated only. Downloads a pinned per-platform build over HTTPS (system `curl`), verifies it
//! against the build host's published `checksums.sha256` (fetched at install time — a rolling "latest"
//! build cannot carry a hash pinned in the binary), extracts it (system `tar`; bsdtar handles `.zip` on
//! Windows/macOS, GNU tar handles `.tar.xz` on Linux), and installs `ffmpeg`/`ffprobe` into
//! `<app_data>/bin`. Progress is emitted as `install://progress`. No Rust TLS/zip stack is added (a Rust
//! TLS client would pull an OpenSSL-licensed crate that `deny.toml` forbids).

use crate::dto::InstallProgress;
use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;

/// Event carrying [`InstallProgress`] during an install.
pub const INSTALL_EVENT: &str = "install://progress";

struct Source {
    archive_url: &'static str,
    checksums_url: &'static str,
    /// The file name as it appears in `checksums.sha256`.
    archive_name: &'static str,
}

fn source() -> Option<Source> {
    #[cfg(target_os = "windows")]
    {
        Some(Source {
            archive_url: concat!(
                "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/",
                "ffmpeg-master-latest-win64-gpl.zip"
            ),
            checksums_url: concat!(
                "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/",
                "checksums.sha256"
            ),
            archive_name: "ffmpeg-master-latest-win64-gpl.zip",
        })
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Some(Source {
            archive_url: concat!(
                "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/",
                "ffmpeg-master-latest-linux64-gpl.tar.xz"
            ),
            checksums_url: concat!(
                "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/",
                "checksums.sha256"
            ),
            archive_name: "ffmpeg-master-latest-linux64-gpl.tar.xz",
        })
    }
    #[cfg(target_os = "macos")]
    {
        // BtbN has no macOS build; evermeet/martin-riedl use a different (per-file) checksum mechanism.
        // Rather than ship an unverified download, macOS points the user at Homebrew (a first-class
        // "install manually" state, ADR-CORE-037). Tracked as a follow-up.
        None
    }
}

/// Download → verify → extract → install ffmpeg/ffprobe into `bin_dir`, emitting `install://progress`.
pub async fn run(app: &AppHandle, bin_dir: &Path) -> Result<()> {
    let Some(src) = source() else {
        let msg = "automatic install is not available on this platform — install ffmpeg manually (e.g. `brew install ffmpeg`)";
        emit(app, "error", -1.0, Some(msg.to_string()));
        return Err(AppError::Other(msg.to_string()));
    };

    let work = std::env::temp_dir().join("vidforge-ffmpeg-install");
    let _ = std::fs::remove_dir_all(&work);
    std::fs::create_dir_all(&work).map_err(|e| AppError::io(work.display().to_string(), e))?;
    let archive = work.join(src.archive_name);

    tracing::info!(url = src.archive_url, "ffmpeg install: download");
    emit(app, "download", 0.0, None);
    if let Err(e) = download(app, src.archive_url, &archive).await {
        emit(app, "error", -1.0, Some(e.to_string()));
        return Err(e);
    }

    tracing::info!("ffmpeg install: verify");
    emit(app, "verify", 72.0, None);
    if let Err(e) = verify(&src, &archive).await {
        emit(app, "error", -1.0, Some(e.to_string()));
        return Err(e);
    }

    tracing::info!("ffmpeg install: extract");
    emit(app, "extract", 82.0, None);
    let extracted = work.join("extracted");
    if let Err(e) = extract(&archive, &extracted).await {
        emit(app, "error", -1.0, Some(e.to_string()));
        return Err(e);
    }

    tracing::info!("ffmpeg install: install binaries");
    emit(app, "install", 94.0, None);
    if let Err(e) = find_and_install(&extracted, bin_dir) {
        emit(app, "error", -1.0, Some(e.to_string()));
        return Err(e);
    }

    let _ = std::fs::remove_dir_all(&work);
    emit(app, "done", 100.0, None);
    tracing::info!(bin_dir = %bin_dir.display(), "ffmpeg installed");
    Ok(())
}

async fn download(app: &AppHandle, url: &str, dest: &Path) -> Result<()> {
    let total = content_length(url).await;
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(Path::new("curl")));
    cmd.args(["-L", "--fail", "--silent", "--show-error", "-o"]);
    cmd.arg(dest);
    cmd.arg(url);
    cmd.stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::Other(format!("could not start curl (is it installed?): {e}")))?;

    let mut ticker = tokio::time::interval(std::time::Duration::from_millis(400));
    ticker.tick().await; // consume the immediate first tick
    let status = loop {
        tokio::select! {
            s = child.wait() => break s,
            _ = ticker.tick() => {
                match (total, std::fs::metadata(dest)) {
                    (Some(total), Ok(meta)) if total > 0 => {
                        let pct = (meta.len() as f64 / total as f64 * 70.0).clamp(0.0, 70.0);
                        emit(app, "download", pct, None);
                    }
                    _ => emit(app, "download", -1.0, None),
                }
            }
        }
    };
    let status = status.map_err(|e| AppError::Other(format!("waiting for curl failed: {e}")))?;
    if !status.success() {
        let mut err = String::new();
        if let Some(mut se) = child.stderr.take() {
            let _ = se.read_to_string(&mut err).await;
        }
        return Err(AppError::Other(format!(
            "download failed: {}",
            err.trim().lines().last().unwrap_or("curl error")
        )));
    }
    emit(app, "download", 70.0, None);
    Ok(())
}

async fn verify(src: &Source, archive: &Path) -> Result<()> {
    let actual = sha256_hex(archive)?;
    let checksums = fetch_text(src.checksums_url).await.ok_or_else(|| {
        AppError::Other("could not fetch the checksum file to verify the download".to_string())
    })?;
    let expected = parse_expected(&checksums, src.archive_name).ok_or_else(|| {
        AppError::Other("no checksum was published for the downloaded file".to_string())
    })?;
    if actual != expected {
        let _ = std::fs::remove_file(archive);
        return Err(AppError::Other(
            "the download failed its integrity check (SHA-256 mismatch) and was discarded"
                .to_string(),
        ));
    }
    tracing::info!("ffmpeg download verified (sha256)");
    Ok(())
}

/// Find the hex hash for `name` in a `checksums.sha256` file (`<hash>  <name>` lines).
fn parse_expected(checksums: &str, name: &str) -> Option<String> {
    checksums
        .lines()
        .find(|l| l.contains(name))
        .and_then(|l| l.split_whitespace().next())
        .map(|h| h.to_ascii_lowercase())
}

fn sha256_hex(path: &Path) -> Result<String> {
    use sha2::{Digest, Sha256};
    let bytes = std::fs::read(path).map_err(|e| AppError::io(path.display().to_string(), e))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}

async fn extract(archive: &Path, dest: &Path) -> Result<()> {
    std::fs::create_dir_all(dest).map_err(|e| AppError::io(dest.display().to_string(), e))?;
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(Path::new("tar")));
    cmd.arg("-xf").arg(archive).arg("-C").arg(dest);
    let out = cmd
        .output()
        .await
        .map_err(|e| AppError::Other(format!("could not start tar (is it installed?): {e}")))?;
    if !out.status.success() {
        return Err(AppError::Other(format!(
            "extracting the archive failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        )));
    }
    Ok(())
}

fn find_and_install(extracted: &Path, bin_dir: &Path) -> Result<()> {
    std::fs::create_dir_all(bin_dir).map_err(|e| AppError::io(bin_dir.display().to_string(), e))?;
    for tool in ["ffmpeg", "ffprobe"] {
        let exe = crate::ffmpeg::discover::exe_name(tool);
        let found = find_file(extracted, &exe).ok_or_else(|| {
            AppError::Other(format!("{exe} was not found in the downloaded archive"))
        })?;
        let dest = bin_dir.join(&exe);
        std::fs::copy(&found, &dest).map_err(|e| AppError::io(dest.display().to_string(), e))?;
        set_executable(&dest);
        tracing::info!(tool, dest = %dest.display(), "installed ffmpeg tool");
    }
    Ok(())
}

/// Recursively find a file named `name` under `root`. Symlinks are not followed (loop safety).
fn find_file(root: &Path, name: &str) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(ft) = entry.file_type() else { continue };
            let path = entry.path();
            if ft.is_dir() {
                stack.push(path);
            } else if ft.is_file() && entry.file_name().to_str() == Some(name) {
                return Some(path);
            }
        }
    }
    None
}

#[cfg(unix)]
fn set_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    if let Ok(meta) = std::fs::metadata(path) {
        let mut perms = meta.permissions();
        perms.set_mode(0o755);
        let _ = std::fs::set_permissions(path, perms);
    }
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) {}

async fn content_length(url: &str) -> Option<u64> {
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(Path::new("curl")));
    cmd.args(["-sIL", url]);
    let out = cmd.output().await.ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    text.lines()
        .rev()
        .find_map(|line| {
            line.to_ascii_lowercase()
                .strip_prefix("content-length:")
                .map(|v| v.trim().to_string())
        })
        .and_then(|v| v.parse::<u64>().ok())
}

async fn fetch_text(url: &str) -> Option<String> {
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(Path::new("curl")));
    cmd.args(["-sL", "--fail", url]);
    let out = cmd.output().await.ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

fn emit(app: &AppHandle, phase: &str, percent: f64, message: Option<String>) {
    let _ = app.emit(
        INSTALL_EVENT,
        InstallProgress {
            phase: phase.to_string(),
            percent,
            message,
        },
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_expected_finds_the_matching_hash() {
        let checksums = "abc123  other-file.zip\nDEADBEEF  ffmpeg-master-latest-win64-gpl.zip\n";
        assert_eq!(
            parse_expected(checksums, "ffmpeg-master-latest-win64-gpl.zip"),
            Some("deadbeef".to_string())
        );
        assert_eq!(parse_expected(checksums, "not-present.zip"), None);
    }

    #[test]
    fn sha256_hex_of_known_input() {
        let dir = tempfile::tempdir().expect("tempdir");
        let f = dir.path().join("x");
        std::fs::write(&f, b"abc").expect("w");
        // Known SHA-256 of "abc".
        assert_eq!(
            sha256_hex(&f).expect("hash"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn find_file_locates_a_nested_binary() {
        let dir = tempfile::tempdir().expect("tempdir");
        let deep = dir.path().join("a").join("bin");
        std::fs::create_dir_all(&deep).expect("mkdir");
        let target = deep.join("ffmpeg.exe");
        std::fs::write(&target, b"x").expect("w");
        assert_eq!(find_file(dir.path(), "ffmpeg.exe"), Some(target));
        assert_eq!(find_file(dir.path(), "missing"), None);
    }
}
