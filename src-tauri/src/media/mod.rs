//! Video domain services (ADR-PROJ-001, rule:media-pipeline): scanning a folder, reading metadata via
//! `ffprobe`, deriving a quality rating, and generating thumbnails via `ffmpeg`. Everything here shells
//! out to the external tools — nothing decodes video in-process.

pub mod probe;
pub mod quality;
pub mod scan;
pub mod thumbnail;

use crate::error::{AppError, Result};
use std::path::PathBuf;
use tauri::Manager;

/// The app cache root: `<app_data>/cache` (thumbnails, prepared player sources, …).
fn cache_root(app: &tauri::AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(format!("resolve app data dir: {e}")))?
        .join("cache");
    Ok(dir)
}

/// Where generated thumbnails are cached (never beside the source).
pub fn thumbs_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    Ok(cache_root(app)?.join("thumbnails"))
}

/// Where prepared (remuxed/transcoded) player sources are cached (ADR-PROJ-001 §5). Served to the webview
/// via the asset protocol.
pub fn player_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    Ok(cache_root(app)?.join("player"))
}

/// End-to-end exercise of the media pipeline against the REAL ffmpeg/ffprobe (ADR-CORE-004: prove it, do
/// not assert it from reading the code). Skips gracefully where the tools are absent (e.g. a CI box
/// without ffmpeg) — on a developer machine with ffmpeg it generates a real clip, probes it and
/// thumbnails it.
#[cfg(test)]
mod e2e_tests {
    use super::*;
    use crate::dto::QualityTier;
    use crate::ffmpeg::discover::find_tool;
    use std::path::Path;

    fn tools() -> Option<(PathBuf, PathBuf)> {
        let no_managed = Path::new("__vidforge_no_managed_dir__");
        let ffmpeg = find_tool("ffmpeg", None, no_managed)?.0;
        let ffprobe = find_tool("ffprobe", None, no_managed)?.0;
        Some((ffmpeg, ffprobe))
    }

    fn generate_sample(ffmpeg: &Path, out: &Path) {
        let status = crate::ffmpeg::command(ffmpeg)
            .args([
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=1:size=1280x720:rate=10",
                "-pix_fmt",
                "yuv420p",
            ])
            .arg(out)
            .status()
            .expect("run ffmpeg to make a sample");
        assert!(status.success(), "sample generation failed");
    }

    #[tokio::test]
    async fn probe_and_thumbnail_a_real_generated_clip() {
        let Some((ffmpeg, ffprobe)) = tools() else {
            eprintln!("SKIP media e2e: ffmpeg/ffprobe not found on PATH");
            return;
        };
        let dir = tempfile::tempdir().expect("tempdir");
        let sample = dir.path().join("sample.mp4");
        generate_sample(&ffmpeg, &sample);

        let info = probe::probe(&ffprobe, &sample).await.expect("probe");
        let v = info.video.expect("clip has a video stream");
        assert_eq!((v.width, v.height), (1280, 720));
        assert_eq!(v.codec, "h264");
        assert_eq!(info.quality, QualityTier::Fair); // 720p -> gold/fair
        assert!(info.duration_secs.unwrap_or(0.0) > 0.5);

        let uri = thumbnail::thumbnail(&ffmpeg, &sample, &dir.path().join("cache"), 160)
            .await
            .expect("thumbnail");
        assert!(uri.starts_with("data:image/jpeg;base64,"));
        assert!(uri.len() > 200, "thumbnail should carry real image bytes");
    }
}
