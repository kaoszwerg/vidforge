// Pure quality-tier mappings (ADR-PROJ-001 §3), the one home for "what colour/label does a tier get".
// Lives in `lib/` rather than in `QualityBadge.tsx` so a non-component consumer (`VideoCard`'s inline
// resolution badge) can reuse the accent without importing from a component module — which would also
// trip `react-refresh/only-export-components` (a `.tsx` may only export components).

import type { QualityTier } from "../bindings/QualityTier";
import type { HudAccent } from "../components/ui/hudButton";
import type { MessageKey } from "../i18n";

/** Resolution-based accent (ADR-PROJ-001 §3): green at ≥1080p, ramping through gold to danger below.
 * A `switch` over the closed `QualityTier` union rather than a lookup table so TypeScript proves every
 * tier is handled — a tier added on the Rust side without a matching case here is a compile error. */
export function accentForTier(tier: QualityTier): HudAccent {
  switch (tier) {
    case "Excellent":
    case "Good":
      return "green";
    case "Fair":
    case "Low":
      return "gold";
    case "Poor":
      return "danger";
  }
}

/** The i18n key for a tier's short label (e.g. "Good" → the "quality.good" catalogue entry). Same
 * exhaustive-`switch` guarantee as `accentForTier`. */
export function labelKeyForTier(tier: QualityTier): MessageKey {
  switch (tier) {
    case "Excellent":
      return "quality.excellent";
    case "Good":
      return "quality.good";
    case "Fair":
      return "quality.fair";
    case "Low":
      return "quality.low";
    case "Poor":
      return "quality.poor";
  }
}
