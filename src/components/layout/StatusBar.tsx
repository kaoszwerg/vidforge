import { Button } from "../ui/Button";
import { useBuildInfo } from "../../hooks/useBuildInfo";
import { useT } from "../../i18n";
import { useUiStore } from "../../store/ui";
import { APP_NAME } from "../../lib/app";

/** Bottom status strip: build identity (click → About dialog) and the scroll-to-top control. */
export function StatusBar({
  canScrollTop = false,
  onScrollTop,
}: {
  canScrollTop?: boolean;
  onScrollTop?: () => void;
}) {
  const { data: build } = useBuildInfo();
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);
  const t = useT();

  return (
    <div className="hud-strip hud-strip-bottom flex h-7 shrink-0 items-center justify-between px-3 font-mono text-[10px] text-[var(--saga-text-dim)]">
      <Button
        variant="ghost"
        onClick={() => setAboutOpen(true)}
        tooltip={t("statusbar.aboutTooltip", { name: APP_NAME })}
      >
        {APP_NAME} {build ? `v${build.version}` : ""}
        {build ? (
          <span className="text-dim ml-1">
            ({build.git_sha}
            {build.git_dirty ? "+" : ""})
          </span>
        ) : null}
        {build?.channel === "dev" ? (
          <span className="text-gold ml-1">· {t("statusbar.devSuffix")}</span>
        ) : null}
      </Button>
      <div className="flex items-center gap-3">
        {canScrollTop ? (
          <Button
            variant="ghost"
            onClick={onScrollTop}
            aria-label={t("statusbar.scrollToTop")}
            tooltip={t("statusbar.scrollToTop")}
            className="tracking-wider uppercase"
          >
            {t("statusbar.scrollToTopShort")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
