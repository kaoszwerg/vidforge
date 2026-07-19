import { de, en, type Language, type MessageKey } from "./messages";

// Lookup tables built once from the (readable, hand-edited) catalogue objects in messages.ts. `Map`
// rather than plain-object bracket access is deliberate, not stylistic: the key is chosen at runtime
// (the caller's `lang`/`key`), and a `Map.get()` has no bracket-indexing/prototype-pollution surface
// the way `obj[dynamicKey]` does — the property this file's `security/detect-object-injection` gate
// exists to catch. `.get()` also makes "missing key" an explicit `undefined` instead of `unknown`.
const DE_TABLE = new Map<MessageKey, string>(Object.entries(de) as [MessageKey, string][]);
const EN_TABLE = new Map<MessageKey, string>(Object.entries(en) as [MessageKey, string][]);

function tableFor(lang: Language): Map<MessageKey, string> {
  return lang === "en" ? EN_TABLE : DE_TABLE;
}

/**
 * Resolve a message key to display text in the given language (ADR-PROJ-001 §6: de/en UI).
 *
 * Falls back to German when `lang`'s table is missing the key (a translation gap), and to the raw key
 * itself when even German has none — which should not happen for a valid `MessageKey`, but keeps the
 * UI legible instead of rendering nothing. Interpolates `{name}`-style placeholders from `params`: a
 * placeholder with no matching value is left as literal text rather than silently dropped, so a
 * missing param is visible instead of producing a sentence with a hole in it.
 */
export function translate(
  lang: Language,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const raw = tableFor(lang).get(key) ?? DE_TABLE.get(key) ?? key;
  if (!params) return raw;
  const paramMap = new Map(Object.entries(params));
  return raw.replace(/\{(\w+)\}/g, (placeholder: string, name: string) => {
    const val = paramMap.get(name);
    return val === undefined ? placeholder : String(val);
  });
}
