//! Resolution-based quality rating (ADR-PROJ-001 §3, owner's spec): green at >=1080p, ramping through
//! gold/orange to red below. Resolution only — bitrate/codec may refine it later (marked, not assumed).

use crate::dto::QualityTier;

/// Map a video height in pixels to a quality tier.
pub fn tier_for_height(height: u32) -> QualityTier {
    match height {
        h if h >= 1440 => QualityTier::Excellent,
        h if h >= 1080 => QualityTier::Good,
        h if h >= 720 => QualityTier::Fair,
        h if h >= 480 => QualityTier::Low,
        _ => QualityTier::Poor,
    }
}

/// The tier for an optional video height. A file with no video stream is the lowest tier.
pub fn tier_for(video_height: Option<u32>) -> QualityTier {
    video_height
        .map(tier_for_height)
        .unwrap_or(QualityTier::Poor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiers_follow_the_resolution_ladder() {
        assert_eq!(tier_for_height(2160), QualityTier::Excellent);
        assert_eq!(tier_for_height(1440), QualityTier::Excellent);
        assert_eq!(tier_for_height(1439), QualityTier::Good);
        assert_eq!(tier_for_height(1080), QualityTier::Good); // green starts at 1080p
        assert_eq!(tier_for_height(1079), QualityTier::Fair);
        assert_eq!(tier_for_height(720), QualityTier::Fair);
        assert_eq!(tier_for_height(719), QualityTier::Low);
        assert_eq!(tier_for_height(480), QualityTier::Low);
        assert_eq!(tier_for_height(479), QualityTier::Poor);
        assert_eq!(tier_for_height(0), QualityTier::Poor);
    }

    #[test]
    fn no_video_stream_is_poor() {
        assert_eq!(tier_for(None), QualityTier::Poor);
        assert_eq!(tier_for(Some(1080)), QualityTier::Good);
    }
}
