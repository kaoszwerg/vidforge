/** Application display name — single source for all frontend labels (ADR-CORE-005). Synced from
 * app.identity.json by `identity:sync` (ADR-APP-031); do not hand-edit the value. */
export const APP_NAME = "Vidforge";

/** Tagline — single source for the title bar and the About dialog (ADR-CORE-005). */
export const APP_TAGLINE = "Every format, reforged.";

/** One-paragraph description shown in the About dialog (synced from app.identity.json). */
export const APP_DESCRIPTION =
  "Point Vidforge at a folder and it lists every video as a card with a thumbnail and full technical metadata — resolution, container, video and audio codecs, bitrate, frame rate and more. Repair defective files and re-encode or convert between MP4, MKV and AVI, with a one-click visually-lossless MP4/H.264 default and fully configurable presets. Conversions run as non-blocking background jobs in a queue with live per-job progress, driven by a system-installed ffmpeg that Vidforge detects automatically.";
