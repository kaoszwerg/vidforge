//! Internal player source preparation (ADR-PROJ-001 §5, rule:media-pipeline).
//!
//! The player is an HTML5 `<video>` in the webview — no VLC, no separate window. The webview cannot play
//! arbitrary containers/codecs, so a source is made playable in the **app cache** first: a web-friendly
//! source (H.264 + AAC/MP3) is **remuxed** into MP4 (`-c copy`, near-instant); anything else is
//! **transcoded** to H.264/AAC. The frontend then plays the cached MP4 via the asset protocol
//! (`convertFileSrc`), which handles HTTP range requests (seeking) for free. No custom streaming protocol.

use crate::dto::PreparedPlayback;
use crate::error::{AppError, Result};
use std::hash::{Hash, Hasher};
use std::path::Path;

/// Whether a source can be made playable by a remux (`-c copy`) rather than a re-encode. Conservative:
/// H.264 video with AAC/MP3 (or no) audio plays in every supported system webview once in MP4.
fn is_web_playable(video_codec: &str, audio_codec: &str) -> bool {
    video_codec == "h264" && matches!(audio_codec, "aac" | "mp3" | "")
}

/// Prepare `source` for the internal player, returning a cached, webview-playable MP4. Reuses a cached
/// result when present (keyed by path+mtime+size+mode).
pub async fn prepare(
    ffmpeg: &Path,
    ffprobe: &Path,
    source: &Path,
    cache_dir: &Path,
) -> Result<PreparedPlayback> {
    let info = crate::media::probe::probe(ffprobe, source).await?;
    let vcodec = info.video.as_ref().map(|v| v.codec.as_str()).unwrap_or("");
    let acodec = info.audio.first().map(|a| a.codec.as_str()).unwrap_or("");
    let transcode = !is_web_playable(vcodec, acodec);

    let out = cache_dir.join(format!("{}.mp4", cache_key(source, transcode)));
    if !out.is_file() {
        std::fs::create_dir_all(cache_dir)
            .map_err(|e| AppError::io(cache_dir.display().to_string(), e))?;
        run(ffmpeg, source, &out, transcode).await?;
    }
    Ok(PreparedPlayback {
        file_path: out.to_string_lossy().to_string(),
        transcoded: transcode,
    })
}

fn cache_key(source: &Path, transcode: bool) -> String {
    let meta = std::fs::metadata(source).ok();
    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let mtime = meta
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    source.to_string_lossy().hash(&mut hasher);
    size.hash(&mut hasher);
    mtime.hash(&mut hasher);
    transcode.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

async fn run(ffmpeg: &Path, source: &Path, out: &Path, transcode: bool) -> Result<()> {
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(ffmpeg));
    cmd.args(["-y", "-i"]);
    cmd.arg(source);
    if transcode {
        cmd.args([
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c:v",
            "libx264",
            "-crf",
            "20",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
        ]);
    } else {
        cmd.args([
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-c",
            "copy",
            "-movflags",
            "+faststart",
        ]);
    }
    cmd.arg(out);
    let o = cmd
        .output()
        .await
        .map_err(|e| AppError::Other(format!("could not run ffmpeg: {e}")))?;
    if !o.status.success() || !out.is_file() {
        return Err(AppError::Other(format!(
            "preparing playback failed: {}",
            String::from_utf8_lossy(&o.stderr)
                .lines()
                .last()
                .unwrap_or("")
                .trim()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_playable_only_for_h264_with_safe_audio() {
        assert!(is_web_playable("h264", "aac"));
        assert!(is_web_playable("h264", "mp3"));
        assert!(is_web_playable("h264", ""));
        assert!(!is_web_playable("hevc", "aac"));
        assert!(!is_web_playable("h264", "ac3"));
        assert!(!is_web_playable("vp9", "opus"));
    }

    #[test]
    fn cache_key_varies_with_mode_and_content() {
        let dir = tempfile::tempdir().expect("tempdir");
        let f = dir.path().join("v.mkv");
        std::fs::write(&f, b"aaaa").expect("w");
        assert_eq!(cache_key(&f, false), cache_key(&f, false), "stable");
        assert_ne!(
            cache_key(&f, false),
            cache_key(&f, true),
            "mode changes the key"
        );
        let before = cache_key(&f, true);
        std::fs::write(&f, b"different-and-longer").expect("w2");
        assert_ne!(before, cache_key(&f, true), "changed size -> new key");
    }
}

/// Prove player preparation against the REAL ffmpeg (ADR-CORE-004). Skips where ffmpeg is absent.
#[cfg(test)]
mod e2e_tests {
    use super::*;
    use crate::ffmpeg::discover::find_tool;
    use std::path::PathBuf;

    fn tools() -> Option<(PathBuf, PathBuf)> {
        let none = Path::new("__vidforge_no_managed__");
        Some((
            find_tool("ffmpeg", None, none)?.0,
            find_tool("ffprobe", None, none)?.0,
        ))
    }

    #[tokio::test]
    async fn prepares_a_non_web_source_by_transcoding_to_h264_mp4_and_caches_it() {
        let Some((ffmpeg, ffprobe)) = tools() else {
            eprintln!("SKIP player e2e: ffmpeg/ffprobe not found");
            return;
        };
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("in.avi"); // AVI -> mpeg4 video, not directly web-playable
        crate::ffmpeg::command(&ffmpeg)
            .args([
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=1:size=320x240:rate=10",
                "-pix_fmt",
                "yuv420p",
            ])
            .arg(&src)
            .status()
            .expect("generate avi");

        let cache = dir.path().join("cache");
        let prepared = prepare(&ffmpeg, &ffprobe, &src, &cache)
            .await
            .expect("prepare");
        assert!(prepared.transcoded, "an mpeg4 source must be transcoded");
        let out = PathBuf::from(&prepared.file_path);
        assert!(out.is_file(), "prepared file must exist");

        let info = crate::media::probe::probe(&ffprobe, &out)
            .await
            .expect("probe out");
        assert_eq!(
            info.video.expect("video").codec,
            "h264",
            "output must be H.264"
        );

        // A second prepare reuses the cache (same path, no error).
        let again = prepare(&ffmpeg, &ffprobe, &src, &cache)
            .await
            .expect("prepare again");
        assert_eq!(again.file_path, prepared.file_path);
    }
}
