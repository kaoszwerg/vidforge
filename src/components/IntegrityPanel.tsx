import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { HudPanel } from "./ui/HudPanel";
import { Button } from "./ui/Button";
import { useIntegrity } from "../hooks/useIntegrity";
import { useT } from "../i18n";

export interface IntegrityPanelProps {
  /** Absolute path of the video, as produced by `scan_folder`. */
  path: string;
}

/**
 * Integrity panel for the Detail view (ADR-PROJ-001): shows whether a file is defective and offers a
 * deeper check. The **quick** check runs automatically (container/packets, seconds); a **deep** check
 * (full decode, catches stream corruption) is one click away and, once run, becomes the authoritative
 * result. A defective file turns the panel red and points at the Repair action below — the repair itself
 * lives in the Actions panel (one place for it, ADR-CORE-005). A check being *unavailable* (e.g. ffmpeg
 * not installed) is stated, never a crash (ADR-CORE-037).
 */
export function IntegrityPanel({ path }: IntegrityPanelProps) {
  const t = useT();
  const quick = useIntegrity(path, false);
  const [deepRequested, setDeepRequested] = useState(false);
  const deep = useIntegrity(path, true, deepRequested);

  // The deep result supersedes the quick one once it's in; until then, show the quick verdict.
  const report = deep.data ?? quick.data;
  const deepPending = deepRequested && deep.isPending;
  const defective = report?.healthy === false;

  return (
    <HudPanel accent={defective ? "danger" : "cyan"} label={t("integrity.title")}>
      <div className="space-y-2 text-sm">
        {!report && (quick.isPending || deepPending) ? (
          <p className="text-dim flex items-center gap-2">
            <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden />
            {t("integrity.checking")}
          </p>
        ) : !report && quick.isError ? (
          <p className="text-dim text-xs">{t("integrity.unavailable")}</p>
        ) : report && defective ? (
          <>
            <p className="text-danger flex items-center gap-2">
              <AlertTriangle size={15} strokeWidth={2} aria-hidden />
              {t("integrity.defectiveCount", { count: report.error_count })}
            </p>
            {report.sample_errors.length > 0 ? (
              <ul className="text-dim/90 bg-deep/40 hud-clip-sm max-h-28 space-y-0.5 overflow-auto p-2 font-mono text-[11px] leading-relaxed">
                {report.sample_errors.slice(0, 5).map((line, i) => (
                  <li key={i} className="break-all">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-dim text-xs">{t("integrity.repairHint")}</p>
          </>
        ) : report ? (
          <p className="text-green flex items-center gap-2">
            <CheckCircle2 size={15} strokeWidth={2} aria-hidden />
            {t(report.level === "Deep" ? "integrity.healthyDeep" : "integrity.healthyQuick")}
          </p>
        ) : null}

        {/* Deep check offered until one has actually run (a deep report's `level` is "Deep"). */}
        {report?.level !== "Deep" ? (
          <Button
            variant="ghost"
            onClick={() => setDeepRequested(true)}
            disabled={deepPending}
            className="px-2.5 py-1 text-xs"
          >
            {deepPending ? t("integrity.checkingDeep") : t("integrity.deepCheck")}
          </Button>
        ) : null}
      </div>
    </HudPanel>
  );
}
