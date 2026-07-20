//! Internal player source preparation (ADR-PROJ-001 §5, rule:media-pipeline).
//!
//! The player is an HTML5 `<video>` in the webview — no VLC, no separate window.
//!
//! **The source is played untouched whenever possible** (owner: just show the video, don't prepare a
//! copy, don't make the user wait). A file the webview can already play as-is — a web container
//! (`.mp4`/`.mov`/`.m4v`) holding H.264 video with AAC/MP3 (or no) audio — is returned **directly**: no
//! ffmpeg runs, and the command grants the asset scope that one file. Only a source the webview *cannot*
//! play is made playable in the **app cache** first: a web-friendly codec in a foreign container is
//! **remuxed** into MP4 (`-c copy`, near-instant); anything else is **transcoded** to H.264/AAC. Either
//! way the frontend plays `file_path` via the asset protocol (`convertFileSrc`), which handles HTTP range
//! requests (seeking) for free. No custom streaming protocol, no autoplay.

use crate::dto::PreparedPlayback;
use crate::error::{AppError, Result};
use std::hash::{Hash, Hasher};
use std::path::Path;

/// Whether a source's *codec* can be made playable by a remux (`-c copy`) rather than a re-encode.
/// Conservative: H.264 video with AAC/MP3 (or no) audio plays in every supported system webview once in
/// an MP4 container.
fn is_web_playable(video_codec: &str, audio_codec: &str) -> bool {
    video_codec == "h264" && matches!(audio_codec, "aac" | "mp3" | "")
}

/// Whether a source can be played **as-is**, with no ffmpeg at all: a web *container* the webview reads
/// natively (`.mp4`/`.mov`/`.m4v`) AND a [`is_web_playable`] codec. Deliberately narrow so it holds on
/// every target webview — WebView2, WKWebView and WebKitGTK (rule:cross-platform): e.g. `.webm`/VP9 is
/// fine on Chromium but not WKWebView, so it is left to the (still fast) remux path rather than risked
/// here. The container is taken from the file extension, not the probed `format_name`, because that is
/// exactly what the webview keys its container handling off.
fn is_direct_playable(source: &Path, video_codec: &str, audio_codec: &str) -> bool {
    let web_container = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .is_some_and(|e| matches!(e.as_str(), "mp4" | "m4v" | "mov"));
    web_container && is_web_playable(video_codec, audio_codec)
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

    // Fast path: a source the webview plays as-is is returned untouched — no ffmpeg, no cache, no wait.
    // The command grants the asset scope this exact file (least privilege) before handing the URL back.
    if is_direct_playable(source, vcodec, acodec) {
        tracing::info!(source = %source.display(), "prepare_player: direct (no ffmpeg)");
        return Ok(PreparedPlayback {
            file_path: source.to_string_lossy().to_string(),
            transcoded: false,
            direct: true,
        });
    }

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
        direct: false,
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
    fn direct_playable_needs_both_a_web_container_and_a_web_codec() {
        let d = |name: &str, v: &str, a: &str| is_direct_playable(Path::new(name), v, a);
        // Web container + web codec → play as-is.
        assert!(d("/x/a.mp4", "h264", "aac"));
        assert!(d("/x/a.MOV", "h264", "")); // extension match is case-insensitive; no audio is fine
        assert!(d("/x/a.m4v", "h264", "mp3"));
        // Right codec, foreign container → not direct (a remux still makes it playable).
        assert!(!d("/x/a.mkv", "h264", "aac"));
        assert!(!d("/x/a.webm", "h264", "aac"));
        // Web container, wrong codec → not direct (needs a transcode).
        assert!(!d("/x/a.mp4", "hevc", "aac"));
        assert!(!d("/x/a.mp4", "h264", "ac3"));
        // No extension at all.
        assert!(!d("/x/a", "h264", "aac"));
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

    #[tokio::test]
    async fn plays_a_web_playable_mp4_directly_without_ffmpeg_or_cache() {
        let Some((ffmpeg, ffprobe)) = tools() else {
            eprintln!("SKIP player e2e: ffmpeg/ffprobe not found");
            return;
        };
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("in.mp4"); // MP4 container + H.264 → directly webview-playable
        crate::ffmpeg::command(&ffmpeg)
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
            .arg(&src)
            .status()
            .expect("generate mp4");

        let cache = dir.path().join("cache");
        let prepared = prepare(&ffmpeg, &ffprobe, &src, &cache)
            .await
            .expect("prepare");

        assert!(prepared.direct, "an H.264 MP4 must play directly");
        assert!(!prepared.transcoded, "direct play never transcodes");
        assert_eq!(
            prepared.file_path,
            src.to_string_lossy(),
            "direct play returns the original path untouched"
        );
        // No ffmpeg ran for a direct source, so nothing was written to the cache.
        let cache_empty = !cache.exists()
            || std::fs::read_dir(&cache)
                .map(|mut d| d.next().is_none())
                .unwrap_or(true);
        assert!(cache_empty, "a direct source must not create a cache file");
    }
}
