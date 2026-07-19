// The message catalogue (ADR-PROJ-001 §6): a minimal in-house i18n layer for a two-language app — no
// i18n dependency (rule:dependencies). `de` is the single source of truth for which keys exist; `en` is
// typed against it (`Record<MessageKey, string>`) so a key added to one and forgotten in the other is a
// compile error, not a silent gap discovered by a user. Keys are dot-namespaced strings grouped by the
// view/component they belong to (`nav.*`, `settings.*`, …); `common.*` holds strings shared by more than
// one of them (rule:reusability — one source per cross-cutting concern).
//
// `APP_NAME` / `APP_TAGLINE` / `APP_DESCRIPTION` (src/lib/app.ts) are deliberately NOT in here: they are
// the identity SSOT synced from `app.identity.json` (ADR-APP-031) into package.json, Cargo.toml and the
// Tauri configs alike — non-UI consumers that have no concept of a UI language — so the product name and
// tagline stay the same word in every language, exactly like a real brand name would.

/** German UI strings — the source of truth for which keys exist (ADR-PROJ-001 §6, German default). */
export const de = {
  // Shared across more than one view/component.
  "common.close": "Schließen",
  "common.loading": "Lädt…",
  "common.back": "Zurück",
  "common.yes": "Ja",
  "common.no": "Nein",
  "common.meta.version": "version",
  "common.meta.channel": "kanal",
  "common.meta.commit": "commit",
  "common.meta.commitDate": "commit-datum",
  "common.meta.debug": "debug",

  // Sidebar navigation (also reused as view headings).
  "nav.primaryLandmark": "Hauptnavigation",
  "nav.library": "Bibliothek",
  "nav.home": "Start",
  "nav.logs": "Protokolle",
  "nav.settings": "Einstellungen",

  // Resolution-based quality tier (QualityBadge, ADR-PROJ-001 §3).
  "quality.excellent": "Exzellent",
  "quality.good": "Gut",
  "quality.fair": "Mittel",
  "quality.low": "Niedrig",
  "quality.poor": "Schlecht",

  // LibraryView.
  "library.dropzone.label": "Ordner hierher ziehen oder durchsuchen",
  "library.dropzone.browse": "Durchsuchen…",
  "library.scanning": "Scanne Ordner…",
  "library.empty": "Keine Videos in diesem Ordner gefunden.",
  "library.scanError.title": "Scan fehlgeschlagen",
  "library.ffmpegMissing.title": "ffmpeg nicht gefunden",
  "library.ffmpegMissing.body":
    "Vidforge benötigt ffmpeg und ffprobe, um Videos zu scannen und abzuspielen. Installiere beide und starte die App neu, hinterlege den Pfad in den Einstellungen, oder installiere ffmpeg direkt über die Schaltfläche unten.",
  "library.card.probeError": "Metadaten konnten nicht gelesen werden: {message}",
  "library.selectCount": "{count} ausgewählt",
  "library.selectConvert": "Ausgewählte konvertieren",
  "library.selectClear": "Auswahl aufheben",

  // ffmpeg installer (LibraryView's ffmpeg-missing notice, ADR-PROJ-001 §2 — the one opt-in network
  // egress; the download source and SHA-256 verification are disclosed here per rule:privacy).
  "install.button": "ffmpeg installieren",
  "install.explain":
    "Lädt eine zu diesem Betriebssystem passende ffmpeg-Version herunter, prüft ihre Integrität per SHA-256 und installiert sie lokal im App-Datenverzeichnis.",
  "install.phase.download": "Lade herunter…",
  "install.phase.verify": "Prüfe Integrität…",
  "install.phase.extract": "Entpacke…",
  "install.phase.install": "Installiere…",
  "install.phase.done": "Fertig",
  "install.failed": "Installation fehlgeschlagen.",

  // DetailView.
  "detail.error.title": "Metadaten-Fehler",
  "detail.panel.file": "Datei",
  "detail.panel.video": "Video",
  "detail.panel.audio": "Audio",
  "detail.panel.subtitles": "Untertitel",
  "detail.panel.player": "Player",
  "detail.panel.actions": "Aktionen",
  "detail.container": "container",
  "detail.duration": "dauer",
  "detail.size": "größe",
  "detail.bitrate": "bitrate",
  "detail.resolution": "auflösung",
  "detail.codec": "codec",
  "detail.fps": "bildrate",
  "detail.pixfmt": "pixelformat",
  "detail.hdr": "hdr",
  "detail.channels": "kanäle",
  "detail.sampleRate": "abtastrate",
  "detail.language": "sprache",
  "detail.language.unknown": "unbekannt",
  "detail.player.comingSoon": "Player folgt demnächst.",
  "detail.convert": "Konvertieren",
  "detail.repair": "Reparieren",
  "detail.enqueued": "„{name}“ wurde der Warteschlange hinzugefügt.",
  "detail.enqueueError": "Fehler beim Hinzufügen zur Warteschlange: {message}",

  // Preset picker (DetailView + LibraryView bulk bar) — labels/descriptions for the built-in
  // conversion/repair presets (ADR-PROJ-001 §4). `src/lib/presets.ts` maps a `PresetDto.id` to these.
  "preset.selectLabel": "Preset",
  "preset.universal": "Universal",
  "preset.universal.desc": "Visuell verlustfrei, MP4/H.264 – der empfohlene Standard.",
  "preset.efficient": "Effizient",
  "preset.efficient.desc":
    "Kleinere Dateien durch stärkere Kompression, minimal geringere Qualität.",
  "preset.archive": "Archiv",
  "preset.archive.desc": "Hohe Qualität für die Langzeitarchivierung als MKV.",
  "preset.repair": "Reparieren",
  "preset.repair.desc": "Remuxt die Datei ohne Neucodierung, um Beschädigungen zu beheben.",
  "preset.custom": "Benutzerdefiniert",
  "preset.custom.desc": "Manuell konfigurierte Encoding-Parameter.",

  // HomeView.
  "home.panel.shell": "Shell",
  "home.panel.build": "Build",
  "home.panel.next": "Weiteres",
  "home.shell.item1": "Rahmenloses HUD-Fenster mit eigenem Fensterrahmen und Tray-Integration",
  "home.shell.item2":
    "Typisierte IPC-Schnittstelle (ts-rs-Bindings als einzige Quelle der Wahrheit)",
  "home.shell.item3":
    "Strukturiertes Logging: Konsole, rotierende JSON-Datei, Live-Protokollansicht",
  "home.shell.item4": "Persistierte Einstellungen und Fenstergeometrie",
  "home.next.info":
    "Die Shell enthält bewusst keine Fachlogik. Produktfunktionen werden als eigene Module hinzugefügt: ein Rust-Modul plus Commands im Backend, eine View plus Hooks im Frontend.",
  "home.next.intro": "Noch keine Produktfunktionen.",
  "home.next.step1": "Füge ein Backend-Modul unter",
  "home.next.step2": ", stelle es über",
  "home.next.step3": "bereit und gib ihm eine View unter",
  "home.next.step4": "sowie einen Eintrag in der Sidebar.",

  // LogsView.
  "logs.searchPlaceholder": "suchen…",
  "logs.searchAriaLabel": "Protokolle durchsuchen",
  "logs.toggleSortTooltip": "Sortierreihenfolge umschalten",
  "logs.newest": "neueste",
  "logs.oldest": "älteste",
  "logs.live": "live",
  "logs.paused": "pausiert",
  "logs.clear": "leeren",
  "logs.recordsCount": "{count} Einträge",
  "logs.loadError": "Fehler beim Laden der Protokolle: {message}",
  "logs.noRecords": "Keine Protokolleinträge.",

  // SettingsView.
  "settings.title": "Einstellungen",
  "settings.info":
    "Einstellungen werden als JSON im App-Datenverzeichnis des Betriebssystems gespeichert und auf den nativen WebView-Zoom angewendet, sodass sie einen Neustart überdauern.",
  "settings.uiScale": "UI-Skalierung",
  "settings.closeButtonLabel": "Schließen-Schaltfläche",
  "settings.quitApp": "App beenden",
  "settings.minimizeToTray": "In den Tray minimieren",
  "settings.closeButtonDescription":
    "Legt fest, was die Schaltfläche zum Schließen des Fensters bewirkt. „{minimizeToTray}“ hält die App im Hintergrund im System-Tray aktiv, mit einem Menü zum Öffnen/Beenden.",
  "settings.language": "Sprache",

  // AboutDialog.
  "about.title": "Über",

  // TitleBar.
  "titlebar.devBadge": "Dev",
  "titlebar.minimize": "Minimieren",
  "titlebar.maximize": "Maximieren",

  // StatusBar.
  "statusbar.aboutTooltip": "Über {name}",
  "statusbar.scrollToTop": "Nach oben scrollen",
  "statusbar.scrollToTopShort": "↑ oben",
  "statusbar.devSuffix": "dev",
  "statusbar.jobsIdleTooltip": "Keine aktiven Aufgaben",
  "statusbar.jobsActiveTooltip": "{running} laufend, {queued} wartend",

  // Job queue (status-bar process list, ADR-PROJ-001 §4).
  "jobs.popover.title": "Warteschlange",
  "jobs.popover.empty": "Keine Aufgaben.",
  "jobs.popover.recent": "Zuletzt",
  "jobs.cancel": "Abbrechen",
  "jobs.state.queued": "wartend",
  "jobs.state.running": "läuft",
  "jobs.state.done": "fertig",
  "jobs.state.failed": "fehlgeschlagen",
  "jobs.state.cancelled": "abgebrochen",

  // FatalScreen (ADR-CORE-037, ADR-APP-032 — the UI's last-resort screen).
  "fatal.title": "Schwerwiegender Fehler",
  "fatal.body":
    "Die Oberfläche ist auf einen Fehler gestoßen, von dem sie sich nicht erholen konnte, und wurde angehalten. Deine Einstellungen und Protokolle auf der Festplatte sind unverändert.",
  "fatal.reportPre": "Ein Absturzbericht wurde geschrieben nach",
  "fatal.reportPost": ". Er bleibt auf diesem Gerät — sende ihn mit, wenn du dies meldest.",
  "fatal.reportMissing":
    "Der Absturzbericht konnte nicht geschrieben werden. Der Fehler ist weiterhin im Anwendungsprotokoll im App-Datenverzeichnis vorhanden.",
  "fatal.restart": "Oberfläche neu starten",
  "fatal.quit": "Beenden",

  // CrashNotice (the previous-run crash banner).
  "crashNotice.title": "Die letzte Sitzung wurde durch einen Absturz beendet.",
  "crashNotice.bodyPre": "Ein Bericht wurde gespeichert unter",
  "crashNotice.bodyPost": ". Er bleibt auf diesem Gerät.",
  "crashNotice.dismiss": "Verwerfen",
} as const;

/** Every valid message key, derived from `de` (the source of truth for which keys exist). */
export type MessageKey = keyof typeof de;

/** The UI languages this app supports (ADR-PROJ-001 §6). German is first/default. */
export const LANGUAGES = ["de", "en"] as const;

/** A supported UI language code. Matches `SettingsDto.language` once sanitised — see `useT`'s
 * `normalise`, which mirrors the backend's own fallback-to-German for anything else. */
export type Language = (typeof LANGUAGES)[number];

/** English UI strings. Typed against `MessageKey` so a key present in `de` but missing here — or a
 * stale key removed from `de` but left here — is a compile error, not a runtime gap a user finds. */
export const en: Record<MessageKey, string> = {
  "common.close": "Close",
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.yes": "Yes",
  "common.no": "No",
  "common.meta.version": "version",
  "common.meta.channel": "channel",
  "common.meta.commit": "commit",
  "common.meta.commitDate": "commit date",
  "common.meta.debug": "debug",

  "nav.primaryLandmark": "Primary",
  "nav.library": "Library",
  "nav.home": "Home",
  "nav.logs": "Logs",
  "nav.settings": "Settings",

  "quality.excellent": "Excellent",
  "quality.good": "Good",
  "quality.fair": "Fair",
  "quality.low": "Low",
  "quality.poor": "Poor",

  "library.dropzone.label": "Drop a folder here or browse to select one",
  "library.dropzone.browse": "Browse…",
  "library.scanning": "Scanning folder…",
  "library.empty": "No videos found in this folder.",
  "library.scanError.title": "Scan failed",
  "library.ffmpegMissing.title": "ffmpeg not found",
  "library.ffmpegMissing.body":
    "Vidforge needs ffmpeg and ffprobe to scan and play videos. Install both and restart the app, set the path in Settings, or install ffmpeg directly using the button below.",
  "library.card.probeError": "Could not read metadata: {message}",
  "library.selectCount": "{count} selected",
  "library.selectConvert": "Convert selected",
  "library.selectClear": "Clear selection",

  "install.button": "Install ffmpeg",
  "install.explain":
    "Downloads an ffmpeg build matching this operating system, verifies its integrity via SHA-256, and installs it locally in the app data directory.",
  "install.phase.download": "Downloading…",
  "install.phase.verify": "Verifying…",
  "install.phase.extract": "Extracting…",
  "install.phase.install": "Installing…",
  "install.phase.done": "Done",
  "install.failed": "Install failed.",

  "detail.error.title": "Metadata error",
  "detail.panel.file": "File",
  "detail.panel.video": "Video",
  "detail.panel.audio": "Audio",
  "detail.panel.subtitles": "Subtitles",
  "detail.panel.player": "Player",
  "detail.panel.actions": "Actions",
  "detail.container": "container",
  "detail.duration": "duration",
  "detail.size": "size",
  "detail.bitrate": "bitrate",
  "detail.resolution": "resolution",
  "detail.codec": "codec",
  "detail.fps": "fps",
  "detail.pixfmt": "pixel format",
  "detail.hdr": "hdr",
  "detail.channels": "channels",
  "detail.sampleRate": "sample rate",
  "detail.language": "language",
  "detail.language.unknown": "unknown",
  "detail.player.comingSoon": "Player support is coming soon.",
  "detail.convert": "Convert",
  "detail.repair": "Repair",
  "detail.enqueued": 'Added "{name}" to the queue.',
  "detail.enqueueError": "Failed to queue: {message}",

  "preset.selectLabel": "Preset",
  "preset.universal": "Universal",
  "preset.universal.desc": "Visually lossless MP4/H.264 — the recommended default.",
  "preset.efficient": "Efficient",
  "preset.efficient.desc": "Smaller files via stronger compression, at a slightly lower quality.",
  "preset.archive": "Archive",
  "preset.archive.desc": "High quality for long-term archival as MKV.",
  "preset.repair": "Repair",
  "preset.repair.desc": "Remuxes the file without re-encoding to fix corruption.",
  "preset.custom": "Custom",
  "preset.custom.desc": "Manually configured encode parameters.",

  "home.panel.shell": "Shell",
  "home.panel.build": "Build",
  "home.panel.next": "Next",
  "home.shell.item1": "Frameless HUD window with custom chrome and tray integration",
  "home.shell.item2": "Typed IPC surface (ts-rs bindings as the single source of truth)",
  "home.shell.item3": "Structured logging: console, rotating JSON file, live log view",
  "home.shell.item4": "Persisted settings and window geometry",
  "home.next.info":
    "The shell carries no domain logic on purpose. Product features are added as their own modules: a Rust module plus commands in the backend, a view plus hooks in the frontend.",
  "home.next.intro": "No product features yet.",
  "home.next.step1": "Add a backend module under",
  "home.next.step2": ", expose it through",
  "home.next.step3": "and give it a view under",
  "home.next.step4": "plus an entry in the sidebar.",

  "logs.searchPlaceholder": "search…",
  "logs.searchAriaLabel": "Search logs",
  "logs.toggleSortTooltip": "Toggle sort order",
  "logs.newest": "newest",
  "logs.oldest": "oldest",
  "logs.live": "live",
  "logs.paused": "paused",
  "logs.clear": "clear",
  "logs.recordsCount": "{count} records",
  "logs.loadError": "Failed to load logs: {message}",
  "logs.noRecords": "No log records.",

  "settings.title": "Preferences",
  "settings.info":
    "Settings are persisted as JSON under the OS app-data directory and applied to the native WebView zoom, so they survive restarts.",
  "settings.uiScale": "UI scale",
  "settings.closeButtonLabel": "Close button",
  "settings.quitApp": "Quit app",
  "settings.minimizeToTray": "Minimize to tray",
  "settings.closeButtonDescription":
    "What the window's close button does. “{minimizeToTray}” keeps the app running in the system tray with an Open/Quit menu.",
  "settings.language": "Language",

  "about.title": "About",

  "titlebar.devBadge": "Dev",
  "titlebar.minimize": "Minimize",
  "titlebar.maximize": "Maximize",

  "statusbar.aboutTooltip": "About {name}",
  "statusbar.scrollToTop": "Scroll to top",
  "statusbar.scrollToTopShort": "↑ top",
  "statusbar.devSuffix": "dev",
  "statusbar.jobsIdleTooltip": "No active jobs",
  "statusbar.jobsActiveTooltip": "{running} running, {queued} queued",

  "jobs.popover.title": "Queue",
  "jobs.popover.empty": "No jobs.",
  "jobs.popover.recent": "Recent",
  "jobs.cancel": "Cancel",
  "jobs.state.queued": "queued",
  "jobs.state.running": "running",
  "jobs.state.done": "done",
  "jobs.state.failed": "failed",
  "jobs.state.cancelled": "cancelled",

  "fatal.title": "Fatal error",
  "fatal.body":
    "The interface hit an error it could not recover from and has stopped. Your settings and logs on disk are untouched.",
  "fatal.reportPre": "A crash report was written to",
  "fatal.reportPost": ". It stays on this device — send it along if you report this.",
  "fatal.reportMissing":
    "The crash report could not be written. The failure is still in the application log under the app data directory.",
  "fatal.restart": "Restart interface",
  "fatal.quit": "Quit",

  "crashNotice.title": "The last session ended in a crash.",
  "crashNotice.bodyPre": "A report was saved to",
  "crashNotice.bodyPost": ". It stays on this device.",
  "crashNotice.dismiss": "Dismiss",
};
