import { describe, it, expect } from "vitest";
import {
  applyLibraryViewOptions,
  libraryExtensions,
  librarySortLabelKey,
  LIBRARY_FILTER_ALL,
  LIBRARY_SORT_ORDERS,
  sortLibraryFiles,
} from "./librarySort";
import type { ScannedFile } from "../bindings/ScannedFile";

function file(overrides: Partial<ScannedFile> = {}): ScannedFile {
  return { path: "/videos/a.mp4", name: "a.mp4", extension: "mp4", size_bytes: 1, ...overrides };
}

const FILES: ScannedFile[] = [
  file({ path: "/v/b.mkv", name: "Beta.mkv", extension: "mkv", size_bytes: 300 }),
  file({ path: "/v/a.mp4", name: "alpha.mp4", extension: "mp4", size_bytes: 100 }),
  file({ path: "/v/c.mp4", name: "Charlie.mp4", extension: "mp4", size_bytes: 200 }),
];

describe("librarySortLabelKey", () => {
  it.each([
    ["name-asc", "library.toolbar.sort.nameAsc"],
    ["name-desc", "library.toolbar.sort.nameDesc"],
    ["size-asc", "library.toolbar.sort.sizeAsc"],
    ["size-desc", "library.toolbar.sort.sizeDesc"],
  ] as const)("maps %s to %s", (order, key) => {
    expect(librarySortLabelKey(order)).toBe(key);
  });

  it("has a label key for every declared sort order", () => {
    for (const order of LIBRARY_SORT_ORDERS) {
      expect(librarySortLabelKey(order)).toMatch(/^library\.toolbar\.sort\./);
    }
  });
});

describe("libraryExtensions", () => {
  it("returns the distinct extensions present, alphabetically sorted", () => {
    expect(libraryExtensions(FILES)).toEqual(["mkv", "mp4"]);
  });

  it("returns an empty array for no files", () => {
    expect(libraryExtensions([])).toEqual([]);
  });

  it("de-duplicates repeated extensions", () => {
    expect(libraryExtensions([file({ extension: "mp4" }), file({ extension: "mp4" })])).toEqual([
      "mp4",
    ]);
  });
});

describe("sortLibraryFiles", () => {
  it("sorts by name ascending", () => {
    expect(sortLibraryFiles(FILES, "name-asc").map((f) => f.name)).toEqual([
      "alpha.mp4",
      "Beta.mkv",
      "Charlie.mp4",
    ]);
  });

  it("sorts by name descending", () => {
    expect(sortLibraryFiles(FILES, "name-desc").map((f) => f.name)).toEqual([
      "Charlie.mp4",
      "Beta.mkv",
      "alpha.mp4",
    ]);
  });

  it("sorts by size ascending", () => {
    expect(sortLibraryFiles(FILES, "size-asc").map((f) => f.size_bytes)).toEqual([100, 200, 300]);
  });

  it("sorts by size descending", () => {
    expect(sortLibraryFiles(FILES, "size-desc").map((f) => f.size_bytes)).toEqual([300, 200, 100]);
  });

  it("does not mutate the input array", () => {
    const copy = FILES.slice();
    sortLibraryFiles(FILES, "name-desc");
    expect(FILES).toEqual(copy);
  });
});

describe("applyLibraryViewOptions", () => {
  it("defaults to name-asc sort, all extensions, no query", () => {
    expect(applyLibraryViewOptions(FILES).map((f) => f.name)).toEqual([
      "alpha.mp4",
      "Beta.mkv",
      "Charlie.mp4",
    ]);
  });

  it("filters by a case-insensitive substring of the name", () => {
    expect(applyLibraryViewOptions(FILES, { query: "cha" }).map((f) => f.name)).toEqual([
      "Charlie.mp4",
    ]);
  });

  it("trims surrounding whitespace from the query", () => {
    expect(applyLibraryViewOptions(FILES, { query: "  beta  " }).map((f) => f.name)).toEqual([
      "Beta.mkv",
    ]);
  });

  it("filters by extension", () => {
    expect(applyLibraryViewOptions(FILES, { extension: "mkv" }).map((f) => f.name)).toEqual([
      "Beta.mkv",
    ]);
  });

  it("shows everything when the extension filter is LIBRARY_FILTER_ALL", () => {
    expect(applyLibraryViewOptions(FILES, { extension: LIBRARY_FILTER_ALL })).toHaveLength(3);
  });

  it("combines search, filter and sort", () => {
    const result = applyLibraryViewOptions(FILES, {
      query: "a",
      extension: "mp4",
      sort: "size-desc",
    });
    expect(result.map((f) => f.name)).toEqual(["Charlie.mp4", "alpha.mp4"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(applyLibraryViewOptions(FILES, { query: "nope" })).toEqual([]);
  });

  it("accepts every declared sort order without throwing", () => {
    for (const order of LIBRARY_SORT_ORDERS) {
      expect(() => applyLibraryViewOptions(FILES, { sort: order })).not.toThrow();
    }
  });
});
