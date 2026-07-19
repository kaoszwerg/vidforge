import type { QualityTier } from "../bindings/QualityTier";
import { Badge } from "./ui/Badge";
import type { HudAccent } from "./ui/hudButton";
import { useT } from "../i18n";
import type { MessageKey } from "../i18n";

/** Resolution-based accent (ADR-PROJ-001 §3): green at ≥1080p, ramping through gold to danger below.
 * A `switch` over the closed `QualityTier` union rather than a lookup table so TypeScript proves every
 * tier is handled — a tier added on the Rust side without a matching case here is a compile error. */
function accentForTier(tier: QualityTier): HudAccent {
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

function labelKeyForTier(tier: QualityTier): MessageKey {
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

export interface QualityBadgeProps {
  tier: QualityTier;
  className?: string;
}

/** Resolution-based quality tier rendered as a HUD `Badge` (ADR-PROJ-001 §3). Colour and label are
 * both derived from `tier` here — a call site never re-implements the mapping (ADR-CORE-005). */
export function QualityBadge({ tier, className }: QualityBadgeProps) {
  const t = useT();
  return (
    <Badge accent={accentForTier(tier)} className={className}>
      {t(labelKeyForTier(tier))}
    </Badge>
  );
}
