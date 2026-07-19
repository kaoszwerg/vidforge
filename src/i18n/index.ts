// Public surface of the i18n layer (ADR-PROJ-001 §6). Views/components import from here, never by
// reaching into `./messages` or `./translate` directly, so the module's internal split (catalogue vs.
// lookup vs. hook) can change without touching a call site (ADR-CORE-005).
export { translate } from "./translate";
export { useT } from "./useT";
export { LANGUAGES } from "./messages";
export type { Language, MessageKey } from "./messages";
