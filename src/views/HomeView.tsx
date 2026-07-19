import { HudPanel } from "../components/ui/HudPanel";
import { MetaRow } from "../components/ui/MetaRow";
import { useBuildInfo } from "../hooks/useBuildInfo";
import { useT } from "../i18n";
import { APP_DESCRIPTION, APP_NAME } from "../lib/app";

/** Landing view of the empty shell. It shows what the shell already provides, so the first product
 * feature has an obvious place to land — and it proves the IPC round-trip works (build info comes
 * from the Rust backend). */
export function HomeView() {
  const { data: build } = useBuildInfo();
  const t = useT();

  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <header className="space-y-1">
        <h1
          className="hud-label text-glow-cyan"
          style={{ "--hud-label-size": "1.1rem" } as React.CSSProperties}
        >
          {APP_NAME}
        </h1>
        <p className="text-dim max-w-2xl text-sm leading-relaxed">{APP_DESCRIPTION}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <HudPanel accent="cyan" label={t("home.panel.shell")}>
          <ul className="text-dim space-y-1.5 text-sm">
            <Item>{t("home.shell.item1")}</Item>
            <Item>{t("home.shell.item2")}</Item>
            <Item>{t("home.shell.item3")}</Item>
            <Item>{t("home.shell.item4")}</Item>
          </ul>
        </HudPanel>

        <HudPanel accent="green" label={t("home.panel.build")}>
          <dl className="text-dim grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
            <MetaRow k={t("common.meta.version")} v={build ? `v${build.version}` : "—"} />
            <MetaRow k={t("common.meta.channel")} v={build?.channel ?? "—"} />
            <MetaRow
              k={t("common.meta.commit")}
              v={build ? `${build.git_sha}${build.git_dirty ? "+" : ""}` : "—"}
            />
            <MetaRow k={t("common.meta.debug")} v={build ? String(build.debug) : "—"} />
          </dl>
        </HudPanel>
      </div>

      <HudPanel accent="purple" label={t("home.panel.next")} info={<p>{t("home.next.info")}</p>}>
        <p className="text-dim text-sm leading-relaxed">
          {t("home.next.intro")} {t("home.next.step1")} <code>src-tauri/src/</code>
          {t("home.next.step2")} <code>commands/</code> {t("home.next.step3")}{" "}
          <code>src/views/</code> {t("home.next.step4")}
        </p>
      </HudPanel>
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-cyan">›</span>
      <span>{children}</span>
    </li>
  );
}
