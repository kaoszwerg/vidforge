// Pure search/sort/filter helpers for the Library grid (ADR-PROJ-001). Kept out of `LibraryView` so the
// derive/sort/filter behaviour is unit-tested directly instead of only being reachable through a full
// component render (rule:testing) — mirrors how `src/lib/presets.ts` carries the preset-picker's pure
// logic away from `DetailView`/`LibraryView`.
import type { MessageKey } from "../i18n";
import type { ScannedFile } from "../bindings/ScannedFile";

/** How the grid orders `scan.data` — all four fields (`name`/`size_bytes`) are available straight from
 * the scan, before any file is probed, so sorting never waits on `useProbe`. */
export type LibrarySortOrder = "name-asc" | "name-desc" | "size-asc" | "size-desc";

/** Stable display order for the sort `Select` (ADR-APP-026). */
export const LIBRARY_SORT_ORDERS: readonly LibrarySortOrder[] = [
  "name-asc",
  "name-desc",
  "size-asc",
  "size-desc",
];

/** The extension-filter value meaning "show every file, whatever its extension". */
export const LIBRARY_FILTER_ALL = "all";

/** i18n key for a sort order's label in the toolbar's `Select`. */
export function librarySortLabelKey(order: LibrarySortOrder): MessageKey {
  switch (order) {
    case "name-asc":
      return "library.toolbar.sort.nameAsc";
    case "name-desc":
      return "library.toolbar.sort.nameDesc";
    case "size-asc":
      return "library.toolbar.sort.sizeAsc";
    case "size-desc":
      return "library.toolbar.sort.sizeDesc";
  }
}

/** Distinct extensions present in a scan, alphabetically sorted — drives the extension filter's option
 * list so it always matches what the current folder actually contains, never a hardcoded guess. */
export function libraryExtensions(files: readonly ScannedFile[]): string[] {
  return Array.from(new Set(files.map((f) => f.extension))).sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive substring match against the file name — an empty/whitespace-only query matches
 * everything. */
function matchesQuery(file: ScannedFile, query: string): boolean {
  if (!query) return true;
  return file.name.toLowerCase().includes(query.toLowerCase());
}

/** Sorts a file list by the given order. Always returns a new array — the caller's `scan.data` (React
 * Query cache data) is never mutated in place. */
export function sortLibraryFiles(
  files: readonly ScannedFile[],
  order: LibrarySortOrder,
): ScannedFile[] {
  const sorted = files.slice();
  switch (order) {
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "size-asc":
      sorted.sort((a, b) => a.size_bytes - b.size_bytes);
      break;
    case "size-desc":
      sorted.sort((a, b) => b.size_bytes - a.size_bytes);
      break;
  }
  return sorted;
}

export interface LibraryViewOptions {
  /** Free-text search over the file name (case-insensitive substring). */
  query?: string;
  /** An extension (lower-case, without the dot) or `LIBRARY_FILTER_ALL`. */
  extension?: string;
  sort?: LibrarySortOrder;
}

/**
 * Applies the Library toolbar's search, extension filter and sort — in that order — to a scanned file
 * list. Pure and synchronous: `LibraryView` calls it from a `useMemo` over `scan.data`, so the grid never
 * needs its own copy of this logic.
 */
export function applyLibraryViewOptions(
  files: readonly ScannedFile[],
  { query = "", extension = LIBRARY_FILTER_ALL, sort = "name-asc" }: LibraryViewOptions = {},
): ScannedFile[] {
  const needle = query.trim();
  const filtered = files.filter(
    (f) =>
      matchesQuery(f, needle) && (extension === LIBRARY_FILTER_ALL || f.extension === extension),
  );
  return sortLibraryFiles(filtered, sort);
}
