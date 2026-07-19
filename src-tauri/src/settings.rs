//! Persisted user settings — a small JSON document under `<app_data_dir>/settings.json`.
//!
//! The shell has no database on purpose: settings are a handful of scalar preferences, so a single
//! JSON file (written atomically via a temp file + rename) is the honest fit. Reads are served from
//! an in-memory copy behind an `RwLock`; every write persists immediately, so a crash can never
//! lose more than the write in flight.

use crate::dto::SettingsDto;
use crate::error::{AppError, Result};
use std::path::{Path, PathBuf};
use std::sync::RwLock;

pub const MIN_UI_SCALE: f64 = 0.7;
pub const MAX_UI_SCALE: f64 = 1.6;
pub const MIN_JOB_CONCURRENCY: u32 = 1;
pub const MAX_JOB_CONCURRENCY: u32 = 8;

/// A partial update to the settings — every field optional, an omitted field keeps its current value.
/// Kept as a struct (rather than a long positional argument list) so a new setting is one field, not a
/// new parameter threaded through every call site.
#[derive(Debug, Default, Clone)]
pub struct SettingsPatch {
    pub ui_scale: Option<f64>,
    pub minimize_to_tray: Option<bool>,
    pub language: Option<String>,
    /// A path override; an empty/whitespace string clears the override back to auto-discovery.
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub output_dir: Option<String>,
    pub job_concurrency: Option<u32>,
    pub recursive_scan: Option<bool>,
}

/// Thread-safe settings store: in-memory state + the JSON file it is persisted to.
pub struct SettingsStore {
    path: PathBuf,
    current: RwLock<SettingsDto>,
}

impl SettingsStore {
    /// Load `<data_dir>/settings.json`. A missing or unreadable file yields the defaults — a
    /// corrupt settings file must never stop the app from starting; it is logged and replaced on
    /// the next write.
    pub fn load(data_dir: &Path) -> Self {
        let path = data_dir.join("settings.json");
        let current = match std::fs::read_to_string(&path) {
            Ok(raw) => match serde_json::from_str::<SettingsDto>(&raw) {
                Ok(s) => {
                    tracing::info!(
                        path = %path.display(),
                        ui_scale = s.ui_scale,
                        minimize_to_tray = s.minimize_to_tray,
                        language = %s.language,
                        "settings loaded"
                    );
                    sanitize(s)
                }
                Err(e) => {
                    tracing::warn!(path = %path.display(), error = %e, "settings file unreadable — using defaults");
                    SettingsDto::default()
                }
            },
            Err(_) => {
                tracing::info!(path = %path.display(), "no settings file yet — using defaults");
                SettingsDto::default()
            }
        };
        Self {
            path,
            current: RwLock::new(current),
        }
    }

    /// Current settings snapshot.
    pub fn get(&self) -> SettingsDto {
        match self.current.read() {
            Ok(guard) => guard.clone(),
            Err(_) => SettingsDto::default(),
        }
    }

    /// Apply a partial update, persist it, and return the new state.
    pub fn update(&self, patch: SettingsPatch) -> Result<SettingsDto> {
        let next = {
            let mut guard = self
                .current
                .write()
                .map_err(|_| AppError::Other("settings lock poisoned".into()))?;
            if let Some(scale) = patch.ui_scale {
                guard.ui_scale = scale.clamp(MIN_UI_SCALE, MAX_UI_SCALE);
            }
            if let Some(tray) = patch.minimize_to_tray {
                guard.minimize_to_tray = tray;
            }
            if let Some(lang) = patch.language {
                guard.language = normalize_language(&lang);
            }
            if let Some(p) = patch.ffmpeg_path {
                guard.ffmpeg_path = normalize_optional_path(&p);
            }
            if let Some(p) = patch.ffprobe_path {
                guard.ffprobe_path = normalize_optional_path(&p);
            }
            if let Some(d) = patch.output_dir {
                guard.output_dir = normalize_optional_path(&d);
            }
            if let Some(c) = patch.job_concurrency {
                guard.job_concurrency = c.clamp(MIN_JOB_CONCURRENCY, MAX_JOB_CONCURRENCY);
            }
            if let Some(r) = patch.recursive_scan {
                guard.recursive_scan = r;
            }
            guard.clone()
        };
        self.persist(&next)?;
        tracing::info!(
            ui_scale = next.ui_scale,
            minimize_to_tray = next.minimize_to_tray,
            language = %next.language,
            job_concurrency = next.job_concurrency,
            recursive_scan = next.recursive_scan,
            "settings updated"
        );
        Ok(next)
    }

    /// Write the document atomically: serialise to `<file>.tmp`, then rename over the target, so a
    /// crash mid-write can never leave a half-written settings file behind.
    fn persist(&self, value: &SettingsDto) -> Result<()> {
        let json = serde_json::to_string_pretty(value)?;
        let tmp = self.path.with_extension("json.tmp");
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::io(parent.display().to_string(), e))?;
        }
        std::fs::write(&tmp, json).map_err(|e| AppError::io(tmp.display().to_string(), e))?;
        std::fs::rename(&tmp, &self.path)
            .map_err(|e| AppError::io(self.path.display().to_string(), e))?;
        Ok(())
    }
}

/// Normalise a language code to one we actually ship. Anything unrecognised becomes the default `"de"`,
/// so a hand-edited or older file can never leave the UI without a message table (ADR-PROJ-001).
fn normalize_language(lang: &str) -> String {
    match lang.trim().to_ascii_lowercase().as_str() {
        "en" => "en".to_string(),
        _ => "de".to_string(),
    }
}

/// A blank path override means "clear it, go back to auto-discovery" rather than "a file named ''".
fn normalize_optional_path(p: &str) -> Option<String> {
    let t = p.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

/// Clamp values coming from disk — a hand-edited file must not be able to push the UI to an unusable
/// zoom level, run 999 concurrent ffmpegs, or select a language with no message table.
fn sanitize(mut s: SettingsDto) -> SettingsDto {
    if !s.ui_scale.is_finite() {
        s.ui_scale = 1.0;
    }
    s.ui_scale = s.ui_scale.clamp(MIN_UI_SCALE, MAX_UI_SCALE);
    s.language = normalize_language(&s.language);
    s.job_concurrency = s
        .job_concurrency
        .clamp(MIN_JOB_CONCURRENCY, MAX_JOB_CONCURRENCY);
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A patch that sets only `ui_scale` — the common shape in these tests.
    fn scale(v: f64) -> SettingsPatch {
        SettingsPatch {
            ui_scale: Some(v),
            ..Default::default()
        }
    }

    #[test]
    fn defaults_when_no_file_exists() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        assert_eq!(store.get().ui_scale, 1.0);
        assert!(!store.get().minimize_to_tray);
        assert_eq!(store.get().language, "de");
    }

    #[test]
    fn update_persists_and_reloads() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        let next = store.update(scale(1.25)).expect("update");
        assert_eq!(next.ui_scale, 1.25);

        let reloaded = SettingsStore::load(dir.path());
        assert_eq!(reloaded.get().ui_scale, 1.25);
        assert!(dir.path().join("settings.json").is_file());
    }

    #[test]
    fn ui_scale_is_clamped_on_write_and_read() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        let high = store.update(scale(9.0)).expect("update");
        assert_eq!(high.ui_scale, MAX_UI_SCALE);
        let low = store.update(scale(0.1)).expect("update");
        assert_eq!(low.ui_scale, MIN_UI_SCALE);

        std::fs::write(dir.path().join("settings.json"), r#"{"ui_scale":42.0}"#).expect("write");
        assert_eq!(SettingsStore::load(dir.path()).get().ui_scale, MAX_UI_SCALE);
    }

    #[test]
    fn corrupt_file_falls_back_to_defaults() {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("settings.json"), "not json at all").expect("write");
        assert_eq!(SettingsStore::load(dir.path()).get().ui_scale, 1.0);
    }

    #[test]
    fn minimize_to_tray_persists_and_reloads() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        assert!(!store.get().minimize_to_tray);
        let next = store
            .update(SettingsPatch {
                minimize_to_tray: Some(true),
                ..Default::default()
            })
            .expect("update");
        assert!(next.minimize_to_tray);
        assert!(SettingsStore::load(dir.path()).get().minimize_to_tray);
    }

    #[test]
    fn older_file_without_new_fields_loads_with_defaults() {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("settings.json"), r#"{"ui_scale":1.25}"#).expect("write");
        let s = SettingsStore::load(dir.path()).get();
        assert_eq!(s.ui_scale, 1.25);
        assert!(!s.minimize_to_tray);
        assert_eq!(s.language, "de");
        assert_eq!(s.job_concurrency, 2);
        assert!(s.recursive_scan);
    }

    #[test]
    fn language_is_normalised_on_update_and_load() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        assert_eq!(
            store
                .update(SettingsPatch {
                    language: Some("EN".into()),
                    ..Default::default()
                })
                .expect("update")
                .language,
            "en"
        );
        // An unknown language falls back to the default rather than leaving the UI without strings.
        assert_eq!(
            store
                .update(SettingsPatch {
                    language: Some("fr".into()),
                    ..Default::default()
                })
                .expect("update")
                .language,
            "de"
        );
        std::fs::write(
            dir.path().join("settings.json"),
            r#"{"ui_scale":1.0,"language":"zz"}"#,
        )
        .expect("write");
        assert_eq!(SettingsStore::load(dir.path()).get().language, "de");
    }

    #[test]
    fn job_concurrency_is_clamped() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        assert_eq!(
            store
                .update(SettingsPatch {
                    job_concurrency: Some(99),
                    ..Default::default()
                })
                .expect("update")
                .job_concurrency,
            MAX_JOB_CONCURRENCY
        );
        assert_eq!(
            store
                .update(SettingsPatch {
                    job_concurrency: Some(0),
                    ..Default::default()
                })
                .expect("update")
                .job_concurrency,
            MIN_JOB_CONCURRENCY
        );
    }

    #[test]
    fn blank_path_override_clears_it() {
        let dir = tempfile::tempdir().expect("tempdir");
        let store = SettingsStore::load(dir.path());
        let set = store
            .update(SettingsPatch {
                ffmpeg_path: Some("  C:/ffmpeg/bin/ffmpeg.exe  ".into()),
                ..Default::default()
            })
            .expect("update");
        assert_eq!(set.ffmpeg_path.as_deref(), Some("C:/ffmpeg/bin/ffmpeg.exe"));
        let cleared = store
            .update(SettingsPatch {
                ffmpeg_path: Some("   ".into()),
                ..Default::default()
            })
            .expect("update");
        assert!(cleared.ffmpeg_path.is_none());
    }
}
