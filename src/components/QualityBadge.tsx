import type { QualityTier } from "../bindings/QualityTier";
import { Badge } from "./ui/Badge";
import { accentForTier, labelKeyForTier } from "../lib/quality";
import { useT } from "../i18n";

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
