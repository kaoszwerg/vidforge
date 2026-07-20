import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FolderBrowser } from "./FolderBrowser";

vi.mock("../hooks/useBrowse", () => ({ useBrowseRoots: vi.fn(), useBrowseDir: vi.fn() }));
vi.mock("../hooks/useSettings", () => ({ useSettings: vi.fn() }));

import { useBrowseRoots, useBrowseDir } from "../hooks/useBrowse";
import { useSettings } from "../hooks/useSettings";

const roots = [
  { label: "steve", path: "/home/steve", kind: "Home" as const },
  { label: "C:\\", path: "C:\\", kind: "Drive" as const },
];
const subdirs = [
  { name: "Videos", path: "/home/steve/Videos" },
  { name: "Music", path: "/home/steve/Music" },
];

function mockRoots(overrides: Partial<ReturnType<typeof useBrowseRoots>> = {}) {
  vi.mocked(useBrowseRoots).mockReturnValue({
    data: roots,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useBrowseRoots>);
}

function mockDir(overrides: Partial<ReturnType<typeof useBrowseDir>> = {}) {
  vi.mocked(useBrowseDir).mockReturnValue({
    data: subdirs,
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useBrowseDir>);
}

describe("FolderBrowser", () => {
  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({ data: { language: "de" } } as ReturnType<
      typeof useSettings
    >);
    mockRoots();
    mockDir();
  });

  it("renders nothing when closed", () => {
    render(<FolderBrowser open={false} onClose={vi.fn()} onChoose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the standard roots (translated) and drives in the tree when open", () => {
    render(<FolderBrowser open onClose={vi.fn()} onChoose={vi.fn()} />);
    // "Home" root is translated by its kind; a drive shows its own path label.
    expect(screen.getByRole("button", { name: "Persönlicher Ordner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C:\\" })).toBeInTheDocument();
  });

  it("navigates into a root and lists its subfolders", () => {
    render(<FolderBrowser open onClose={vi.fn()} onChoose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Persönlicher Ordner" }));
    // The content pane now lists that folder's subfolders.
    expect(screen.getByRole("button", { name: "Videos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Music" })).toBeInTheDocument();
  });

  it("keeps the choose action disabled until a folder is selected", () => {
    render(<FolderBrowser open onClose={vi.fn()} onChoose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Diesen Ordner wählen" })).toBeDisabled();
  });

  it("confirms the current folder via the choose action and closes", () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    render(<FolderBrowser open onClose={onClose} onChoose={onChoose} initialPath="/home/steve" />);
    fireEvent.click(screen.getByRole("button", { name: "Diesen Ordner wählen" }));
    expect(onChoose).toHaveBeenCalledWith("/home/steve");
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a folder that can't be opened, in place, instead of crashing", () => {
    mockDir({ data: undefined, isError: true, error: new Error("denied") });
    render(<FolderBrowser open onClose={vi.fn()} onChoose={vi.fn()} initialPath="/locked" />);
    expect(screen.getByText("Ordner kann nicht geöffnet werden")).toBeInTheDocument();
  });
});
