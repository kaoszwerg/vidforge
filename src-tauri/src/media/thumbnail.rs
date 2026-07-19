//! Thumbnail generation (ADR-PROJ-001 §3). One representative frame is extracted with ffmpeg's
//! `thumbnail` filter into the **app cache dir** (never beside the source, rule:media-pipeline), then
//! returned as a `data:image/jpeg;base64,...` URI so the webview can show it without an asset-protocol
//! scope over the user's folders. The cache key is path+mtime+size+width, so a re-encoded file (same
//! path, new content) gets a fresh thumbnail.

use crate::error::{AppError, Result};
use std::hash::{Hash, Hasher};
use std::path::Path;

/// Return a data-URI thumbnail for `file`, generating and caching it under `cache_dir` if absent.
pub async fn thumbnail(ffmpeg: &Path, file: &Path, cache_dir: &Path, width: u32) -> Result<String> {
    let cache_file = cache_dir.join(format!("{}.jpg", cache_key(file, width)));
    if !cache_file.is_file() {
        std::fs::create_dir_all(cache_dir)
            .map_err(|e| AppError::io(cache_dir.display().to_string(), e))?;
        generate(ffmpeg, file, &cache_file, width).await?;
    }
    let bytes = std::fs::read(&cache_file).map_err(|e| AppError::ThumbnailFailed {
        path: file.display().to_string(),
        reason: format!("read cached thumbnail: {e}"),
    })?;
    Ok(to_data_uri(&bytes))
}

fn cache_key(file: &Path, width: u32) -> String {
    let meta = std::fs::metadata(file).ok();
    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let mtime = meta
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    file.to_string_lossy().hash(&mut hasher);
    size.hash(&mut hasher);
    mtime.hash(&mut hasher);
    width.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

async fn generate(ffmpeg: &Path, file: &Path, out: &Path, width: u32) -> Result<()> {
    // `thumbnail` picks a representative frame from the opening window; `scale=W:-1` keeps aspect.
    let vf = format!("thumbnail,scale={width}:-1");
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(ffmpeg));
    cmd.args(["-y", "-i"]);
    cmd.arg(file);
    cmd.args(["-vf", &vf, "-frames:v", "1", "-q:v", "4"]);
    cmd.arg(out);
    let res = cmd.output().await.map_err(|e| AppError::ThumbnailFailed {
        path: file.display().to_string(),
        reason: format!("could not run ffmpeg: {e}"),
    })?;
    if !res.status.success() || !out.is_file() {
        return Err(AppError::ThumbnailFailed {
            path: file.display().to_string(),
            reason: format!(
                "ffmpeg exited with {} ({})",
                res.status,
                String::from_utf8_lossy(&res.stderr)
                    .lines()
                    .last()
                    .unwrap_or("")
            ),
        });
    }
    Ok(())
}

fn to_data_uri(bytes: &[u8]) -> String {
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:image/jpeg;base64,{b64}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn to_data_uri_has_the_jpeg_prefix_and_encodes() {
        let uri = to_data_uri(&[0xFF, 0xD8, 0xFF]);
        assert!(uri.starts_with("data:image/jpeg;base64,"));
        assert_eq!(uri, "data:image/jpeg;base64,/9j/");
    }

    #[test]
    fn cache_key_is_stable_and_varies_with_width_and_content() {
        let dir = tempfile::tempdir().expect("tempdir");
        let f = dir.path().join("clip.mp4");
        std::fs::write(&f, b"aaaa").expect("w");
        let k1 = cache_key(&f, 320);
        let k2 = cache_key(&f, 320);
        assert_eq!(k1, k2, "same inputs -> same key");
        assert_ne!(k1, cache_key(&f, 160), "width changes the key");
        std::fs::write(&f, b"different-bytes").expect("w2");
        assert_ne!(k1, cache_key(&f, 320), "changed size changes the key");
    }
}
