import { useMemo } from "react";
import { useSettings } from "../hooks/useSettings";
import { translate } from "./translate";
import { LANGUAGES, type Language, type MessageKey } from "./messages";

/** Narrow an arbitrary persisted value to a supported language, defaulting to German for anything
 * unrecognised — a fresh install (no settings yet), an older settings file, or a corrupt value.
 * Mirrors the backend's own sanitisation of `SettingsDto.language` (ADR-PROJ-001 §6). */
function normalise(lang: string | undefined): Language {
  return (LANGUAGES as readonly string[]).includes(lang ?? "") ? (lang as Language) : "de";
}

/**
 * Translator bound to the user's current UI language (ADR-PROJ-001 §6: de/en, German default).
 *
 * Reads the language from the persisted settings via `useSettings` (TanStack Query owns that async
 * state — rule:frontend-architecture). While settings are still loading, or hold a value outside
 * `LANGUAGES`, it defaults to German rather than flashing English first. The returned translator is
 * memoised on the resolved language so it is a stable dependency for callers.
 */
export function useT(): (key: MessageKey, params?: Record<string, string | number>) => string {
  const { data } = useSettings();
  const lang = normalise(data?.language);
  return useMemo(
    () => (key: MessageKey, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang],
  );
}
