import { HudPanel } from "../components/ui/HudPanel";
import { Button } from "../components/ui/Button";
import { Select, type SelectOption } from "../components/ui/Select";
import { useSettings, useUpdateSettings } from "../hooks/useSettings";
import { LANGUAGES, useT, type Language } from "../i18n";

const UI_SCALES = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5] as const;

// Language names are shown in their own language regardless of the active UI language (nobody wants
// to hunt for "Deutsch" under an English label "German") — this is the one place in the app where the
// label is intentionally NOT run through `t()`.
const LANGUAGE_OPTIONS: SelectOption<Language>[] = LANGUAGES.map((lang) => ({
  value: lang,
  label: lang === "en" ? "English" : "Deutsch",
}));

/** Settings view: UI scale, the optional close-to-tray behaviour and the UI language, persisted to
 * app-data. */
export function SettingsView() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const t = useT();
  const scale = settings.data?.ui_scale ?? 1;
  const minimizeToTray = settings.data?.minimize_to_tray ?? false;
  const language: Language = settings.data?.language === "en" ? "en" : "de";

  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <HudPanel accent="cyan" label={t("settings.title")} info={<p>{t("settings.info")}</p>}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dim text-xs">{t("settings.uiScale")}</span>
            <div className="flex flex-wrap gap-1">
              {UI_SCALES.map((s) => (
                <Button
                  key={s}
                  aria-pressed={Math.abs(scale - s) < 0.001}
                  active={Math.abs(scale - s) < 0.001}
                  onClick={() => update.mutate({ uiScale: s })}
                  className="px-3 py-1 text-xs"
                >
                  {Math.round(s * 100)}%
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dim text-xs">{t("settings.closeButtonLabel")}</span>
            <div className="flex flex-wrap gap-1">
              <Button
                aria-pressed={!minimizeToTray}
                active={!minimizeToTray}
                onClick={() => update.mutate({ minimizeToTray: false })}
                className="px-3 py-1 text-xs"
              >
                {t("settings.quitApp")}
              </Button>
              <Button
                aria-pressed={minimizeToTray}
                active={minimizeToTray}
                onClick={() => update.mutate({ minimizeToTray: true })}
                className="px-3 py-1 text-xs"
              >
                {t("settings.minimizeToTray")}
              </Button>
            </div>
            <span className="text-dim text-xs">
              {t("settings.closeButtonDescription", {
                minimizeToTray: t("settings.minimizeToTray"),
              })}
            </span>
          </div>

          <Select
            label={t("settings.language")}
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => update.mutate({ language: value })}
            className="items-start"
          />
        </div>
      </HudPanel>
    </div>
  );
}
