//! Video integrity checking (ADR-PROJ-001, rule:media-pipeline): decide whether a file is defective, so
//! the UI can flag it and offer a repair.
//!
//! Two depths, matching the owner's choice. **Quick** copies packets to the null muxer
//! (`-c copy -f null -`): it validates the container/packets in seconds without decoding, and is the one
//! run automatically as each card appears. **Deep** decodes every frame (`-f null -`): it also catches
//! corruption *inside* the stream, but takes roughly as long as the video is, so it is on-demand only.
//! Both are read-only — nothing is written, the source is never touched.

use crate::dto::{IntegrityLevel, IntegrityReport};
use crate::error::{AppError, Result};
use std::path::Path;

/// Cap on retained error lines. A badly corrupt file can emit thousands; the UI only needs a
/// representative sample, and the full log must not balloon the IPC message.
const MAX_SAMPLE: usize = 20;

/// Check `source` for defects at the requested depth. Healthy ⇔ ffmpeg exits cleanly with no
/// `error`-level output. Never fails on a *defective* file — that is a valid, reported result; it only
/// errs if ffmpeg itself cannot be run.
pub async fn check(ffmpeg: &Path, source: &Path, level: IntegrityLevel) -> Result<IntegrityReport> {
    // `-v error`: only error-level lines reach stderr, so any non-empty stderr means a real defect.
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(ffmpeg));
    cmd.args(["-v", "error", "-i"]);
    cmd.arg(source);
    match level {
        IntegrityLevel::Quick => {
            cmd.args(["-c", "copy", "-f", "null", "-"]);
        }
        IntegrityLevel::Deep => {
            cmd.args(["-f", "null", "-"]);
        }
    }

    let out = cmd
        .output()
        .await
        .map_err(|e| AppError::Other(format!("could not run ffmpeg: {e}")))?;

    let stderr = String::from_utf8_lossy(&out.stderr);
    let error_lines: Vec<String> = stderr
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(String::from)
        .collect();

    let healthy = out.status.success() && error_lines.is_empty();
    let error_count = error_lines.len() as u32;
    let sample_errors = error_lines.into_iter().take(MAX_SAMPLE).collect();

    Ok(IntegrityReport {
        path: source.display().to_string(),
        level,
        healthy,
        error_count,
        sample_errors,
    })
}

/// Prove integrity checking against the REAL ffmpeg (ADR-CORE-004). Skips where ffmpeg is absent.
#[cfg(test)]
mod e2e_tests {
    use super::*;
    use crate::ffmpeg::discover::find_tool;
    use std::path::PathBuf;

    fn ffmpeg() -> Option<PathBuf> {
        find_tool("ffmpeg", None, Path::new("__vidforge_no_managed__")).map(|(p, _)| p)
    }

    async fn make_clip(ffmpeg: &Path, out: &Path) {
        crate::ffmpeg::command(ffmpeg)
            .args([
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=1:size=320x240:rate=10",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
            ])
            .arg(out)
            .status()
            .expect("generate clip");
    }

    #[tokio::test]
    async fn a_healthy_clip_passes_both_checks() {
        let Some(ffmpeg) = ffmpeg() else {
            eprintln!("SKIP integrity e2e: ffmpeg not found");
            return;
        };
        let dir = tempfile::tempdir().expect("tempdir");
        let clip = dir.path().join("ok.mp4");
        make_clip(&ffmpeg, &clip).await;

        for level in [IntegrityLevel::Quick, IntegrityLevel::Deep] {
            let report = check(&ffmpeg, &clip, level).await.expect("check");
            assert!(
                report.healthy,
                "a freshly encoded clip must be healthy ({level:?})"
            );
            assert_eq!(report.error_count, 0);
            assert!(report.sample_errors.is_empty());
        }
    }

    #[tokio::test]
    async fn a_truncated_file_is_flagged_defective() {
        let Some(ffmpeg) = ffmpeg() else {
            eprintln!("SKIP integrity e2e: ffmpeg not found");
            return;
        };
        let dir = tempfile::tempdir().expect("tempdir");
        let clip = dir.path().join("ok.mp4");
        make_clip(&ffmpeg, &clip).await;

        // Corrupt it: keep only the first ~40% of the bytes, so the stream ends mid-frame.
        let bytes = std::fs::read(&clip).expect("read");
        let broken = dir.path().join("broken.mp4");
        std::fs::write(&broken, &bytes[..bytes.len() * 4 / 10]).expect("write truncated");

        // The deep decode reliably reports errors on a stream that ends mid-frame.
        let report = check(&ffmpeg, &broken, IntegrityLevel::Deep)
            .await
            .expect("check");
        assert!(
            !report.healthy,
            "a truncated file must be flagged defective"
        );
        assert!(report.error_count > 0);
        assert!(!report.sample_errors.is_empty());
    }
}
