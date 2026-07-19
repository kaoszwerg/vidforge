//! Read a file's technical metadata with `ffprobe` and parse it into [`MediaInfo`] (ADR-PROJ-001 §3).
//!
//! Parsing is done against `serde_json::Value` (not a rigid struct): ffprobe's field presence and the
//! number-vs-string encoding of numeric fields vary by input, so [`parse_probe_json`] is tolerant and
//! is unit-tested against a fixture, independent of a real ffprobe run.

use crate::dto::{AudioStreamInfo, MediaInfo, SubtitleStreamInfo, VideoStreamInfo};
use crate::error::{AppError, Result};
use crate::media::quality;
use serde_json::Value;
use std::path::Path;

/// Probe `file` with the given `ffprobe` binary and return its parsed metadata.
pub async fn probe(ffprobe: &Path, file: &Path) -> Result<MediaInfo> {
    let json = run_ffprobe(ffprobe, file).await?;
    parse_probe_json(&json, file)
}

async fn run_ffprobe(ffprobe: &Path, file: &Path) -> Result<String> {
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(ffprobe));
    cmd.args([
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
    ]);
    cmd.arg(file);
    let out = cmd.output().await.map_err(|e| AppError::ProbeFailed {
        path: file.display().to_string(),
        reason: format!("could not run ffprobe: {e}"),
    })?;
    if !out.status.success() {
        return Err(AppError::ProbeFailed {
            path: file.display().to_string(),
            reason: format!("ffprobe exited with {}", out.status),
        });
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Parse ffprobe `-print_format json -show_format -show_streams` output into [`MediaInfo`].
pub fn parse_probe_json(json: &str, file: &Path) -> Result<MediaInfo> {
    let root: Value = serde_json::from_str(json).map_err(|e| AppError::ProbeFailed {
        path: file.display().to_string(),
        reason: format!("ffprobe json: {e}"),
    })?;

    let format = root.get("format").cloned().unwrap_or(Value::Null);
    let container = str_field(&format, "format_long_name")
        .or_else(|| str_field(&format, "format_name"))
        .unwrap_or("unknown")
        .to_string();
    let duration_secs = format.get("duration").and_then(as_f64).filter(|d| *d > 0.0);
    let size_bytes = format
        .get("size")
        .and_then(as_f64)
        .or_else(|| std::fs::metadata(file).ok().map(|m| m.len() as f64))
        .unwrap_or(0.0);
    let bit_rate = format.get("bit_rate").and_then(as_f64).filter(|b| *b > 0.0);

    let empty = Vec::new();
    let streams = root
        .get("streams")
        .and_then(|s| s.as_array())
        .unwrap_or(&empty);

    let mut video: Option<VideoStreamInfo> = None;
    let mut audio = Vec::new();
    let mut subtitles = Vec::new();

    for s in streams {
        match str_field(s, "codec_type") {
            Some("video") => {
                // Skip attached cover art (a video stream that is really a still image).
                let attached = s
                    .get("disposition")
                    .and_then(|d| d.get("attached_pic"))
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                if attached == 1 || video.is_some() {
                    continue;
                }
                video = Some(VideoStreamInfo {
                    codec: str_field(s, "codec_name").unwrap_or("unknown").to_string(),
                    width: s.get("width").and_then(as_u32).unwrap_or(0),
                    height: s.get("height").and_then(as_u32).unwrap_or(0),
                    fps: frame_rate(s),
                    pix_fmt: str_field(s, "pix_fmt").map(str::to_string),
                    bit_rate: s.get("bit_rate").and_then(as_f64).filter(|b| *b > 0.0),
                    hdr: is_hdr(s),
                });
            }
            Some("audio") => audio.push(AudioStreamInfo {
                codec: str_field(s, "codec_name").unwrap_or("unknown").to_string(),
                channels: s.get("channels").and_then(as_u32).unwrap_or(0),
                sample_rate: s.get("sample_rate").and_then(as_u32).unwrap_or(0),
                bit_rate: s.get("bit_rate").and_then(as_f64).filter(|b| *b > 0.0),
                language: stream_language(s),
            }),
            Some("subtitle") => subtitles.push(SubtitleStreamInfo {
                codec: str_field(s, "codec_name").unwrap_or("unknown").to_string(),
                language: stream_language(s),
            }),
            _ => {}
        }
    }

    let quality = quality::tier_for(video.as_ref().map(|v| v.height));

    Ok(MediaInfo {
        path: file.display().to_string(),
        container,
        duration_secs,
        size_bytes,
        bit_rate,
        video,
        audio,
        subtitles,
        quality,
    })
}

fn str_field<'a>(obj: &'a Value, key: &str) -> Option<&'a str> {
    obj.get(key).and_then(|v| v.as_str())
}

/// ffprobe encodes numeric fields sometimes as JSON numbers, sometimes as strings — accept both.
fn as_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    }
}

fn as_u32(v: &Value) -> Option<u32> {
    as_f64(v).and_then(|f| {
        if f.is_finite() && f >= 0.0 {
            Some(f as u32)
        } else {
            None
        }
    })
}

/// Frames per second from `avg_frame_rate` (preferred) or `r_frame_rate`, each `"num/den"`.
fn frame_rate(stream: &Value) -> f64 {
    let parse = |key: &str| str_field(stream, key).and_then(parse_ratio);
    parse("avg_frame_rate")
        .or_else(|| parse("r_frame_rate"))
        .unwrap_or(0.0)
}

fn parse_ratio(r: &str) -> Option<f64> {
    let (num, den) = r.split_once('/')?;
    let num: f64 = num.trim().parse().ok()?;
    let den: f64 = den.trim().parse().ok()?;
    if den == 0.0 {
        None
    } else {
        Some(num / den)
    }
}

/// HDR when the colour transfer is PQ (`smpte2084`) or HLG (`arib-std-b67`), or the primaries are BT.2020.
fn is_hdr(stream: &Value) -> bool {
    let transfer = str_field(stream, "color_transfer").unwrap_or("");
    let primaries = str_field(stream, "color_primaries").unwrap_or("");
    matches!(transfer, "smpte2084" | "arib-std-b67") || primaries == "bt2020"
}

fn stream_language(s: &Value) -> Option<String> {
    s.get("tags")
        .and_then(|t| t.get("language"))
        .and_then(|v| v.as_str())
        .filter(|l| !l.is_empty() && *l != "und")
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::QualityTier;
    use std::path::PathBuf;

    const SAMPLE: &str = r#"{
      "streams": [
        {"codec_type":"video","codec_name":"h264","width":1920,"height":1080,"pix_fmt":"yuv420p",
         "avg_frame_rate":"30000/1001","r_frame_rate":"30000/1001","bit_rate":"5000000",
         "color_transfer":"bt709","color_primaries":"bt709"},
        {"codec_type":"audio","codec_name":"aac","channels":2,"sample_rate":"48000","bit_rate":"192000",
         "tags":{"language":"eng"}},
        {"codec_type":"subtitle","codec_name":"subrip","tags":{"language":"ger"}}
      ],
      "format": {"format_long_name":"QuickTime / MOV","duration":"12.345","size":"1048576","bit_rate":"5200000"}
    }"#;

    #[test]
    fn parses_a_typical_probe() {
        let info = parse_probe_json(SAMPLE, &PathBuf::from("/x/clip.mov")).expect("parse");
        assert_eq!(info.container, "QuickTime / MOV");
        assert_eq!(info.duration_secs, Some(12.345));
        assert_eq!(info.size_bytes, 1048576.0);
        let v = info.video.expect("video");
        assert_eq!(v.codec, "h264");
        assert_eq!((v.width, v.height), (1920, 1080));
        assert!((v.fps - 29.97).abs() < 0.01);
        assert!(!v.hdr);
        assert_eq!(info.quality, QualityTier::Good);
        assert_eq!(info.audio.len(), 1);
        assert_eq!(info.audio[0].codec, "aac");
        assert_eq!(info.audio[0].channels, 2);
        assert_eq!(info.audio[0].language.as_deref(), Some("eng"));
        assert_eq!(info.subtitles.len(), 1);
        assert_eq!(info.subtitles[0].language.as_deref(), Some("ger"));
    }

    #[test]
    fn hdr_and_no_video_are_detected() {
        let hdr = r#"{"streams":[{"codec_type":"video","codec_name":"hevc","width":3840,"height":2160,
          "avg_frame_rate":"24/1","color_transfer":"smpte2084","color_primaries":"bt2020"}],
          "format":{"format_name":"mov","duration":"1.0","size":"10"}}"#;
        let info = parse_probe_json(hdr, &PathBuf::from("/x/uhd.mov")).expect("parse");
        let v = info.video.expect("video");
        assert!(v.hdr);
        assert_eq!(info.quality, QualityTier::Excellent);

        let audio_only = r#"{"streams":[{"codec_type":"audio","codec_name":"mp3","channels":2,"sample_rate":"44100"}],
          "format":{"format_name":"mp3","duration":"5.0","size":"100"}}"#;
        let info = parse_probe_json(audio_only, &PathBuf::from("/x/a.mp3")).expect("parse");
        assert!(info.video.is_none());
        assert_eq!(info.quality, QualityTier::Poor);
    }

    #[test]
    fn attached_cover_art_is_not_treated_as_the_video() {
        let cover = r#"{"streams":[
          {"codec_type":"video","codec_name":"mjpeg","width":600,"height":600,"disposition":{"attached_pic":1}},
          {"codec_type":"audio","codec_name":"aac","channels":2,"sample_rate":"48000"}],
          "format":{"format_name":"mp4","duration":"3.0","size":"100"}}"#;
        let info = parse_probe_json(cover, &PathBuf::from("/x/song.m4a")).expect("parse");
        assert!(info.video.is_none(), "attached_pic must not count as video");
        assert_eq!(info.quality, QualityTier::Poor);
    }

    #[test]
    fn rejects_invalid_json() {
        let err =
            parse_probe_json("not json", &PathBuf::from("/x/bad.mp4")).expect_err("must fail");
        assert!(err.to_string().contains("bad.mp4"));
    }
}
