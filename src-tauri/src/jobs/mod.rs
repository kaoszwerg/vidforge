//! Conversion/repair jobs (ADR-PROJ-001 §4, rule:media-pipeline): a non-blocking queue that runs one
//! ffmpeg child per job, streams `-progress` into percent, supports cancel, and emits `job://update`
//! events. Output is strictly non-destructive (the source is never overwritten).

pub mod preset;
pub mod queue;

/// Prove a preset's argv actually converts, end-to-end, with the REAL ffmpeg (ADR-CORE-004) — not just
/// that the argv looks right. Skips where ffmpeg is absent.
#[cfg(test)]
mod e2e_tests {
    use super::*;
    use crate::ffmpeg::discover::find_tool;
    use std::path::{Path, PathBuf};

    fn tool(name: &str) -> Option<PathBuf> {
        find_tool(name, None, Path::new("__vidforge_no_managed__")).map(|(p, _)| p)
    }

    #[test]
    fn universal_preset_converts_avi_to_mp4_h264_non_destructively() {
        let (Some(ffmpeg), Some(ffprobe)) = (tool("ffmpeg"), tool("ffprobe")) else {
            eprintln!("SKIP jobs e2e: ffmpeg/ffprobe not found on PATH");
            return;
        };
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("in.avi"); // a non-mp4 source, so conversion is real work
        let gen = crate::ffmpeg::command(&ffmpeg)
            .args([
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=1:size=640x480:rate=10",
                "-pix_fmt",
                "yuv420p",
            ])
            .arg(&src)
            .status()
            .expect("generate avi");
        assert!(gen.success());

        let out = dir.path().join("out.mp4");
        let args = preset::build_args("universal", None, &src, &out).expect("args");
        let conv = crate::ffmpeg::command(&ffmpeg)
            .args(&args)
            .status()
            .expect("convert");
        assert!(conv.success(), "universal conversion failed");
        assert!(out.is_file(), "output mp4 was not produced");

        let probe = crate::ffmpeg::command(&ffprobe)
            .args([
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
            ])
            .arg(&out)
            .output()
            .expect("probe output");
        let info =
            crate::media::probe::parse_probe_json(&String::from_utf8_lossy(&probe.stdout), &out)
                .expect("parse");
        assert_eq!(info.video.expect("video stream").codec, "h264");
        assert!(
            src.is_file(),
            "the source must be untouched (non-destructive)"
        );
        assert_ne!(out, src);
    }
}
