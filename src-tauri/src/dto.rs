//! Boundary types (Rust -> TypeScript). `ts-rs` exports these into `src/bindings/` so the frontend
//! never re-declares a shape by hand (ADR-CORE-005). Run `npm run gen:types` after any change here.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Build identity: SemVer version, channel (dev/release), and the exact commit it was built from
/// (ADR-CORE-024). Rendered in the title bar, status bar and About dialog.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct BuildInfo {
    /// SemVer version, from `package.json` via `CARGO_PKG_VERSION`.
    pub version: String,
    /// Build channel: `"dev"` for debug builds, `"release"` otherwise (ADR-CORE-024).
    pub channel: String,
    /// Whether this is a debug build (`cfg!(debug_assertions)`).
    pub debug: bool,
    /// Short git commit SHA the binary was built from (set by `build.rs`).
    pub git_sha: String,
    /// Whether the working tree was dirty at build time.
    pub git_dirty: bool,
    /// Commit date of `git_sha` (ISO-8601) — answers "what's in this build".
    pub commit_date: String,
}

/// Persisted user preferences. Stored as JSON under `<app_data_dir>/settings.json`.
///
/// Every field carries a serde default so a settings file written by an older version — missing a
/// newer field — still loads (the missing field falls back to its default) rather than failing to
/// parse and silently discarding the user's other preferences.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct SettingsDto {
    /// WebView zoom factor applied to the whole UI (ADR-APP-021). Clamped to [0.7, 1.6].
    #[serde(default = "default_ui_scale")]
    pub ui_scale: f64,
    /// When true, closing the window hides the app to a system-tray icon instead of quitting, so it
    /// keeps running in the background (ADR-APP-021). Default `false` — a fresh app is a normal window.
    #[serde(default)]
    pub minimize_to_tray: bool,
    /// UI language: `"de"` or `"en"` (ADR-PROJ-001). Default `"de"`. Any other value sanitises to `"de"`.
    #[serde(default = "default_language")]
    pub language: String,
    /// Explicit path to the `ffmpeg` binary, overriding discovery. `None` = auto-discover.
    #[serde(default)]
    pub ffmpeg_path: Option<String>,
    /// Explicit path to the `ffprobe` binary, overriding discovery. `None` = auto-discover.
    #[serde(default)]
    pub ffprobe_path: Option<String>,
    /// Default directory conversions/repairs are written to. `None` = a `vidforge-out` folder beside
    /// each source. Output is always non-destructive — the source is never overwritten (ADR-PROJ-001).
    #[serde(default)]
    pub output_dir: Option<String>,
    /// How many conversion jobs run at once. Clamped to [1, 8]. Default 2.
    #[serde(default = "default_job_concurrency")]
    pub job_concurrency: u32,
    /// Whether a folder scan descends into subfolders. Default `true`.
    #[serde(default = "default_true")]
    pub recursive_scan: bool,
}

/// A fatal error from the **UI runtime**, on its way into the durable on-device crash record
/// (ADR-CORE-037, ADR-APP-032).
///
/// The webview is its own entry point: a Rust panic hook cannot see anything thrown inside it, so the
/// frontend hands its last-resort failures over the IPC boundary instead. Nothing here leaves the
/// device (rule:privacy) — it is written to `<app_data_dir>/crashes/` and to the log, and that is all.
#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct CrashReport {
    /// Where in the UI runtime it surfaced: `render`, `uncaught` or `unhandledrejection`.
    pub source: String,
    /// The error's message. Never a secret or user content (rule:logging).
    pub message: String,
    /// JS stack trace, when the thrown value carried one (a thrown string does not).
    pub stack: Option<String>,
}

/// One resolved ffmpeg-suite tool (`ffmpeg` or `ffprobe`) — where it was found and its version.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct FfmpegTool {
    /// Absolute path to the resolved binary.
    pub path: String,
    /// Version line reported by the tool (e.g. `"ffmpeg version 6.1.1"`), or `"unknown"`.
    pub version: String,
    /// How it was resolved: `"override"`, `"managed"`, `"path"` or `"system"`.
    pub source: String,
}

/// Availability of the ffmpeg suite. `ready` is true only when **both** `ffmpeg` and `ffprobe` are
/// present — every media feature checks this first and offers the installer when it is false
/// (ADR-PROJ-001, ADR-CORE-037).
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct FfmpegStatus {
    /// The resolved `ffmpeg` binary, or `None` if it could not be found.
    pub ffmpeg: Option<FfmpegTool>,
    /// The resolved `ffprobe` binary, or `None` if it could not be found.
    pub ffprobe: Option<FfmpegTool>,
    /// True when both tools are present and usable.
    pub ready: bool,
}

/// A video file found by scanning a folder — the lightweight card entry, before it is probed.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct ScannedFile {
    /// Absolute path to the file.
    pub path: String,
    /// File name with extension (display label).
    pub name: String,
    /// Lower-case extension without the dot (e.g. `"mp4"`).
    pub extension: String,
    /// Size in bytes. `f64` (not `u64`) so the TS side gets a plain number, not a `bigint`; video files
    /// are far below the 2^53 exact-integer ceiling.
    pub size_bytes: f64,
}

/// Resolution-based quality tier (ADR-PROJ-001 §3). Green at >=1080p, ramping to red below. The frontend
/// maps each tier to a HUD colour token and a localized label.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub enum QualityTier {
    /// >= 1440p (incl. 4K).
    Excellent,
    /// >= 1080p.
    Good,
    /// >= 720p.
    Fair,
    /// >= 480p.
    Low,
    /// < 480p, or no video stream.
    Poor,
}

/// One video stream from `ffprobe`.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct VideoStreamInfo {
    pub codec: String,
    pub width: u32,
    pub height: u32,
    /// Frames per second (may be fractional, e.g. 29.97).
    pub fps: f64,
    pub pix_fmt: Option<String>,
    pub bit_rate: Option<f64>,
    /// True when the colour metadata indicates HDR (BT.2020 / PQ / HLG).
    pub hdr: bool,
}

/// One audio stream from `ffprobe`.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct AudioStreamInfo {
    pub codec: String,
    pub channels: u32,
    pub sample_rate: u32,
    pub bit_rate: Option<f64>,
    pub language: Option<String>,
}

/// One subtitle stream from `ffprobe`.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct SubtitleStreamInfo {
    pub codec: String,
    pub language: Option<String>,
}

/// Full technical metadata for one video, parsed from `ffprobe -show_format -show_streams` (ADR-PROJ-001).
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct MediaInfo {
    pub path: String,
    /// Container/format long name (e.g. `"QuickTime / MOV"`), from `format.format_long_name`.
    pub container: String,
    pub duration_secs: Option<f64>,
    pub size_bytes: f64,
    /// Overall bit rate in bits/sec.
    pub bit_rate: Option<f64>,
    /// The first video stream, if any.
    pub video: Option<VideoStreamInfo>,
    pub audio: Vec<AudioStreamInfo>,
    pub subtitles: Vec<SubtitleStreamInfo>,
    /// Resolution-based quality tier (derived from the video height).
    pub quality: QualityTier,
}

/// A conversion/repair preset the user can pick. The ffmpeg argv is built server-side
/// (`jobs::preset`); the frontend maps `id` to a localized name/description.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct PresetDto {
    /// `"universal"` | `"efficient"` | `"archive"` | `"repair"` | `"custom"`.
    pub id: String,
    /// Target container extension (e.g. `"mp4"`, `"mkv"`). For `repair` this is the source's container.
    pub container: String,
    /// Whether the output re-encodes the video (false = remux/copy, as in `repair`).
    pub reencodes: bool,
}

/// Custom encode parameters — used only when a job's preset id is `"custom"`.
#[derive(Debug, Clone, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct CustomEncode {
    /// Output container: `"mp4"` | `"mkv"` | `"avi"`.
    pub container: String,
    /// Video codec: `"h264"` | `"hevc"` | `"av1"` | `"ffv1"` | `"copy"`.
    pub video_codec: String,
    /// Constant-quality value (codec-dependent; ignored for `copy`/`ffv1`).
    pub crf: Option<u32>,
    /// Audio codec: `"aac"` | `"opus"` | `"flac"` | `"copy"`.
    pub audio_codec: String,
    /// Audio bitrate in kbit/s (ignored for `copy`/`flac`).
    pub audio_bitrate_k: Option<u32>,
}

/// Lifecycle state of a job.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub enum JobState {
    Queued,
    Running,
    Done,
    Failed,
    Cancelled,
}

/// A conversion/repair job, as shown in the queue and the status-bar process list.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct JobDto {
    pub id: String,
    pub input_path: String,
    pub input_name: String,
    pub output_path: String,
    pub preset_id: String,
    pub state: JobState,
    /// Progress 0..100. Meaningful while `Running`; `Done` is 100.
    pub percent: f64,
    /// Failure detail when `state == Failed`.
    pub error: Option<String>,
}

/// Progress of the in-app ffmpeg install, emitted as `install://progress` (ADR-PROJ-001 §2). The one
/// deliberate network egress — user-initiated, pinned source, SHA-256 verified.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct InstallProgress {
    /// `"download"` | `"verify"` | `"extract"` | `"install"` | `"done"` | `"error"`.
    pub phase: String,
    /// 0..100 overall progress; `-1` when the current phase is indeterminate.
    pub percent: f64,
    /// A short, localizable-key-free human note (e.g. the failure reason on `"error"`).
    pub message: Option<String>,
}

/// A prepared, webview-playable source for the internal player (ADR-PROJ-001 §5). The frontend passes
/// `file_path` to `convertFileSrc` and plays it in a `<video>`; range/seek is handled by the asset
/// protocol.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/")]
pub struct PreparedPlayback {
    /// Absolute path (under the app cache) to an MP4 the webview can play.
    pub file_path: String,
    /// True if the source had to be transcoded (not just remuxed) to become playable.
    pub transcoded: bool,
}

fn default_ui_scale() -> f64 {
    1.0
}

fn default_language() -> String {
    "de".to_string()
}

fn default_job_concurrency() -> u32 {
    2
}

fn default_true() -> bool {
    true
}

impl Default for SettingsDto {
    fn default() -> Self {
        Self {
            ui_scale: default_ui_scale(),
            minimize_to_tray: false,
            language: default_language(),
            ffmpeg_path: None,
            ffprobe_path: None,
            output_dir: None,
            job_concurrency: default_job_concurrency(),
            recursive_scan: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_default_is_scale_one_no_tray() {
        let d = SettingsDto::default();
        assert_eq!(d.ui_scale, 1.0);
        assert!(!d.minimize_to_tray);
    }

    #[test]
    fn settings_default_language_is_german() {
        assert_eq!(SettingsDto::default().language, "de");
    }

    #[test]
    fn settings_default_job_and_scan() {
        let d = SettingsDto::default();
        assert_eq!(d.job_concurrency, 2);
        assert!(d.recursive_scan);
        assert!(d.ffmpeg_path.is_none());
        assert!(d.output_dir.is_none());
    }

    #[test]
    fn settings_roundtrip_through_json() {
        let s = SettingsDto {
            ui_scale: 1.25,
            minimize_to_tray: true,
            language: "en".to_string(),
            ffmpeg_path: Some("C:/ffmpeg/bin/ffmpeg.exe".to_string()),
            ffprobe_path: None,
            output_dir: Some("D:/out".to_string()),
            job_concurrency: 4,
            recursive_scan: false,
        };
        let json = serde_json::to_string(&s).expect("serialize");
        let back: SettingsDto = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.ui_scale, 1.25);
        assert!(back.minimize_to_tray);
        assert_eq!(back.language, "en");
        assert_eq!(
            back.ffmpeg_path.as_deref(),
            Some("C:/ffmpeg/bin/ffmpeg.exe")
        );
        assert_eq!(back.job_concurrency, 4);
        assert!(!back.recursive_scan);
    }

    #[test]
    fn settings_from_older_file_defaults_missing_fields() {
        // A file written before these fields existed must still load without data loss.
        let s: SettingsDto = serde_json::from_str(r#"{"ui_scale":1.25}"#).expect("deserialize");
        assert_eq!(s.ui_scale, 1.25);
        assert!(!s.minimize_to_tray);
        assert_eq!(s.language, "de");
        assert_eq!(s.job_concurrency, 2);
        assert!(s.recursive_scan);
    }

    #[test]
    fn settings_contract_field_names_are_stable() {
        // Pin the JSON keys the generated frontend binding depends on (rule:testing contract).
        let json = serde_json::to_value(SettingsDto::default()).expect("to_value");
        for key in [
            "ui_scale",
            "minimize_to_tray",
            "language",
            "ffmpeg_path",
            "ffprobe_path",
            "output_dir",
            "job_concurrency",
            "recursive_scan",
        ] {
            assert!(
                json.get(key).is_some(),
                "{key} key missing from SettingsDto"
            );
        }
    }

    #[test]
    fn ffmpeg_status_contract_field_names_are_stable() {
        let status = FfmpegStatus {
            ffmpeg: Some(FfmpegTool {
                path: "/usr/bin/ffmpeg".into(),
                version: "ffmpeg version 6.1.1".into(),
                source: "path".into(),
            }),
            ffprobe: None,
            ready: false,
        };
        let json = serde_json::to_value(&status).expect("to_value");
        assert!(json.get("ffmpeg").is_some());
        assert!(json.get("ffprobe").is_some());
        assert!(json.get("ready").is_some());
        let tool = &json["ffmpeg"];
        assert!(tool.get("path").is_some());
        assert!(tool.get("version").is_some());
        assert!(tool.get("source").is_some());
    }
}
