//! ffmpeg argv builders for the conversion/repair presets (ADR-PROJ-001 §4, rule:media-pipeline).
//!
//! Every preset produces an **argv array** (never a shell string). Output is strictly non-destructive:
//! the output path is computed under an output dir and can never equal the source (a same-name/same-dir
//! collision gets a `.vidforge` suffix).

use crate::dto::{CustomEncode, PresetDto};
use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};

/// The built-in presets, in display order. `custom` is driven by [`CustomEncode`].
pub fn all_presets() -> Vec<PresetDto> {
    vec![
        preset("universal", "mp4", true),
        preset("efficient", "mp4", true),
        preset("archive", "mkv", true),
        preset("repair", "source", false),
        preset("custom", "mp4", true),
    ]
}

fn preset(id: &str, container: &str, reencodes: bool) -> PresetDto {
    PresetDto {
        id: id.to_string(),
        container: container.to_string(),
        reencodes,
    }
}

/// The output container extension for a preset. `repair` keeps the source's container.
pub fn target_extension(preset_id: &str, custom: Option<&CustomEncode>, input: &Path) -> String {
    match preset_id {
        "universal" | "efficient" => "mp4".to_string(),
        "archive" => "mkv".to_string(),
        "repair" => input
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .unwrap_or_else(|| "mkv".to_string()),
        "custom" => custom
            .map(|c| c.container.to_ascii_lowercase())
            .unwrap_or_else(|| "mp4".to_string()),
        _ => "mp4".to_string(),
    }
}

/// Non-destructive output path: `<output_dir>/<stem>.<ext>`, never equal to the source.
pub fn output_path(
    input: &Path,
    output_dir: &Path,
    preset_id: &str,
    custom: Option<&CustomEncode>,
) -> PathBuf {
    let ext = target_extension(preset_id, custom, input);
    let stem = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let candidate = output_dir.join(format!("{stem}.{ext}"));
    if candidate == input {
        output_dir.join(format!("{stem}.vidforge.{ext}"))
    } else {
        candidate
    }
}

fn push(args: &mut Vec<String>, parts: &[&str]) {
    args.extend(parts.iter().map(|s| s.to_string()));
}

/// Build the full ffmpeg argv (after the program name) for a preset. Includes `-y` (write to the
/// pre-computed non-destructive output) and `-progress pipe:1 -nostats` for progress parsing.
pub fn build_args(
    preset_id: &str,
    custom: Option<&CustomEncode>,
    input: &Path,
    output: &Path,
) -> Result<Vec<String>> {
    let input = input.to_string_lossy().to_string();
    let output = output.to_string_lossy().to_string();
    let mut a: Vec<String> = Vec::new();
    push(&mut a, &["-y", "-progress", "pipe:1", "-nostats"]);

    match preset_id {
        "universal" => {
            push(&mut a, &["-i"]);
            a.push(input);
            push(
                &mut a,
                &[
                    "-c:v",
                    "libx264",
                    "-crf",
                    "18",
                    "-preset",
                    "medium",
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "192k",
                    "-movflags",
                    "+faststart",
                ],
            );
        }
        "efficient" => {
            push(&mut a, &["-i"]);
            a.push(input);
            push(
                &mut a,
                &[
                    "-c:v",
                    "libx265",
                    "-crf",
                    "24",
                    "-preset",
                    "medium",
                    "-tag:v",
                    "hvc1",
                    "-c:a",
                    "aac",
                    "-b:a",
                    "160k",
                    "-movflags",
                    "+faststart",
                ],
            );
        }
        "archive" => {
            push(&mut a, &["-i"]);
            a.push(input);
            // Mathematically lossless: FFV1 video + FLAC audio in MKV.
            push(&mut a, &["-c:v", "ffv1", "-level", "3", "-c:a", "flac"]);
        }
        "repair" => {
            // Remux, keeping codecs; rebuild timestamps and tolerate errors in the input.
            push(
                &mut a,
                &["-err_detect", "ignore_err", "-fflags", "+genpts", "-i"],
            );
            a.push(input);
            push(&mut a, &["-c", "copy", "-map", "0"]);
        }
        "custom" => {
            let c = custom.ok_or_else(|| {
                AppError::Other("the custom preset requires encode parameters".to_string())
            })?;
            push(&mut a, &["-i"]);
            a.push(input);
            build_custom(&mut a, c);
        }
        other => return Err(AppError::Other(format!("unknown preset: {other}"))),
    }

    a.push(output);
    Ok(a)
}

fn build_custom(a: &mut Vec<String>, c: &CustomEncode) {
    match c.video_codec.as_str() {
        "copy" => push(a, &["-c:v", "copy"]),
        "h264" => {
            push(
                a,
                &[
                    "-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p",
                ],
            );
            crf(a, c.crf.unwrap_or(20));
        }
        "hevc" => {
            push(
                a,
                &["-c:v", "libx265", "-preset", "medium", "-tag:v", "hvc1"],
            );
            crf(a, c.crf.unwrap_or(24));
        }
        "av1" => {
            push(a, &["-c:v", "libsvtav1", "-preset", "6"]);
            crf(a, c.crf.unwrap_or(30));
        }
        "ffv1" => push(a, &["-c:v", "ffv1", "-level", "3"]),
        _ => push(a, &["-c:v", "libx264", "-crf", "20", "-preset", "medium"]),
    }
    match c.audio_codec.as_str() {
        "copy" => push(a, &["-c:a", "copy"]),
        "flac" => push(a, &["-c:a", "flac"]),
        "opus" => {
            push(a, &["-c:a", "libopus"]);
            audio_bitrate(a, c.audio_bitrate_k.unwrap_or(128));
        }
        _ => {
            push(a, &["-c:a", "aac"]);
            audio_bitrate(a, c.audio_bitrate_k.unwrap_or(192));
        }
    }
    if c.container.eq_ignore_ascii_case("mp4") {
        push(a, &["-movflags", "+faststart"]);
    }
}

fn crf(a: &mut Vec<String>, value: u32) {
    a.push("-crf".to_string());
    a.push(value.to_string());
}

fn audio_bitrate(a: &mut Vec<String>, kbit: u32) {
    a.push("-b:a".to_string());
    a.push(format!("{kbit}k"));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(preset: &str, custom: Option<&CustomEncode>) -> Vec<String> {
        build_args(
            preset,
            custom,
            Path::new("/in/clip.avi"),
            Path::new("/out/clip.mp4"),
        )
        .expect("build")
    }

    fn contains_pair(args: &[String], a: &str, b: &str) -> bool {
        args.windows(2).any(|w| w[0] == a && w[1] == b)
    }

    #[test]
    fn universal_is_h264_crf18_aac_faststart() {
        let a = args("universal", None);
        assert!(contains_pair(&a, "-c:v", "libx264"));
        assert!(contains_pair(&a, "-crf", "18"));
        assert!(contains_pair(&a, "-c:a", "aac"));
        assert!(contains_pair(&a, "-movflags", "+faststart"));
        assert!(a.contains(&"-progress".to_string()) && a.contains(&"pipe:1".to_string()));
        assert_eq!(a.last().unwrap(), "/out/clip.mp4");
    }

    #[test]
    fn efficient_is_hevc_and_archive_is_lossless() {
        assert!(contains_pair(&args("efficient", None), "-c:v", "libx265"));
        let arch = args("archive", None);
        assert!(contains_pair(&arch, "-c:v", "ffv1"));
        assert!(contains_pair(&arch, "-c:a", "flac"));
    }

    #[test]
    fn repair_copies_streams_and_rebuilds_timestamps() {
        let a = args("repair", None);
        assert!(contains_pair(&a, "-c", "copy"));
        assert!(contains_pair(&a, "-fflags", "+genpts"));
        assert!(!a.iter().any(|x| x == "libx264"), "repair never re-encodes");
    }

    #[test]
    fn custom_requires_params_and_honours_them() {
        assert!(build_args("custom", None, Path::new("/a.mp4"), Path::new("/b.mp4")).is_err());
        let c = CustomEncode {
            container: "mkv".into(),
            video_codec: "hevc".into(),
            crf: Some(28),
            audio_codec: "opus".into(),
            audio_bitrate_k: Some(96),
        };
        let a = args("custom", Some(&c));
        assert!(contains_pair(&a, "-c:v", "libx265"));
        assert!(contains_pair(&a, "-crf", "28"));
        assert!(contains_pair(&a, "-c:a", "libopus"));
        assert!(contains_pair(&a, "-b:a", "96k"));
    }

    #[test]
    fn unknown_preset_is_an_error() {
        assert!(build_args("nope", None, Path::new("/a"), Path::new("/b")).is_err());
    }

    #[test]
    fn target_extension_and_non_destructive_output() {
        assert_eq!(
            target_extension("universal", None, Path::new("/x/a.mkv")),
            "mp4"
        );
        assert_eq!(
            target_extension("repair", None, Path::new("/x/a.AVI")),
            "avi"
        );
        // repair of an mp4 into the same folder must not target the source path
        let out = output_path(Path::new("/x/a.mp4"), Path::new("/x"), "repair", None);
        assert_eq!(out, PathBuf::from("/x/a.vidforge.mp4"));
        // into a separate dir, the plain name is fine
        let out2 = output_path(Path::new("/in/a.mkv"), Path::new("/out"), "universal", None);
        assert_eq!(out2, PathBuf::from("/out/a.mp4"));
    }
}
