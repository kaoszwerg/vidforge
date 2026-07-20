import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Download,
  FileText,
  Folder,
  HardDrive,
  Home,
  Loader2,
  Monitor,
} from "lucide-react";
import { Dialog } from "./ui/Dialog";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import { useBrowseDir, useBrowseRoots } from "../hooks/useBrowse";
import { useT, type MessageKey } from "../i18n";
import { errorMessage } from "../lib/errors";
import { pathSegments } from "../lib/path";
import type { RootKind } from "../bindings/RootKind";

export interface FolderBrowserProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen absolute folder path when the user confirms. */
  onChoose: (path: string) => void;
  /** Where to open the browser (e.g. the folder already loaded), so reopening lands where you were. */
  initialPath?: string | null;
}

/** Icon for a standard root; a plain folder for everything reached by navigation. */
function RootIcon({ kind }: { kind: RootKind }) {
  const size = 14;
  switch (kind) {
    case "Home":
      return <Home size={size} aria-hidden />;
    case "Desktop":
      return <Monitor size={size} aria-hidden />;
    case "Downloads":
      return <Download size={size} aria-hidden />;
    case "Documents":
      return <FileText size={size} aria-hidden />;
    case "Videos":
      return <Clapperboard size={size} aria-hidden />;
    case "Drive":
      return <HardDrive size={size} aria-hidden />;
  }
}

/** The translated label for a standard root; `null` for a drive, which shows its own path label. */
function rootLabelKey(kind: RootKind): MessageKey | null {
  switch (kind) {
    case "Home":
      return "browser.root.home";
    case "Desktop":
      return "browser.root.desktop";
    case "Downloads":
      return "browser.root.downloads";
    case "Documents":
      return "browser.root.documents";
    case "Videos":
      return "browser.root.videos";
    case "Drive":
      return null;
  }
}

interface TreeNodeProps {
  label: string;
  icon: React.ReactNode;
  path: string;
  depth: number;
  currentPath: string;
  expanded: Set<string>;
  onNavigate: (path: string) => void;
  onToggle: (path: string) => void;
}

/**
 * One row of the browser's directory tree, recursive: expanding it lazily loads its subfolders
 * (`useBrowseDir` enabled only while expanded) and renders each as a nested `TreeNode`. The chevron
 * toggles expansion; the row navigates (loads the folder in the content pane). Loading/empty/error are
 * all rendered in place so a slow or unreadable folder never breaks the tree (ADR-CORE-037).
 */
function TreeNode({
  label,
  icon,
  path,
  depth,
  currentPath,
  expanded,
  onNavigate,
  onToggle,
}: TreeNodeProps) {
  const t = useT();
  const isExpanded = expanded.has(path);
  const children = useBrowseDir(path, isExpanded);
  const isActive = path === currentPath;
  const indent = { paddingLeft: `${depth * 14 + 4}px` };

  return (
    <li>
      <div className="flex items-center gap-0.5" style={indent}>
        <IconButton
          label={t(isExpanded ? "browser.collapse" : "browser.expand")}
          variant="ghost"
          tooltip={null}
          onClick={() => onToggle(path)}
          className="h-6 w-5 shrink-0"
        >
          {isExpanded ? (
            <ChevronDown size={13} strokeWidth={2} />
          ) : (
            <ChevronRight size={13} strokeWidth={2} />
          )}
        </IconButton>
        <Button
          variant="ghost"
          active={isActive}
          onClick={() => onNavigate(path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-left text-xs"
        >
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </Button>
      </div>
      {isExpanded ? (
        <ul>
          {children.isPending ? (
            <li className="text-dim flex items-center gap-1.5 py-1 text-xs" style={indent}>
              <Loader2 size={12} strokeWidth={2} className="animate-spin" aria-hidden />
              {t("common.loading")}
            </li>
          ) : children.isError ? (
            <li className="text-danger py-1 text-xs" style={indent}>
              {t("browser.error")}
            </li>
          ) : children.data && children.data.length > 0 ? (
            children.data.map((child) => (
              <TreeNode
                key={child.path}
                label={child.name}
                icon={<Folder size={14} aria-hidden />}
                path={child.path}
                depth={depth + 1}
                currentPath={currentPath}
                expanded={expanded}
                onNavigate={onNavigate}
                onToggle={onToggle}
              />
            ))
          ) : (
            <li
              className="text-dim/70 py-1 text-xs italic"
              style={{ paddingLeft: `${(depth + 1) * 14 + 4}px` }}
            >
              {t("browser.empty")}
            </li>
          )}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * In-app HUD folder browser (ADR-PROJ-001, owner decision): the design-system replacement for the OS
 * folder picker (ADR-APP-026 — no stock surface, not even the native dialog). A two-column `Dialog`: a
 * lazy, expandable directory **tree** on the left (standard dirs + drives as roots) and the selected
 * folder's sub**folders** on the right, with a clickable breadcrumb above and the current selection plus
 * a confirm action below. Navigating (tree row, content row or breadcrumb) sets the candidate folder;
 * "Choose this folder" confirms it. Read-only throughout — the chosen path is then handed to
 * `scan_folder`, which validates it before any media work.
 */
export function FolderBrowser({ open, onClose, onChoose, initialPath }: FolderBrowserProps) {
  const t = useT();
  const roots = useBrowseRoots(open);
  const [currentPath, setCurrentPath] = useState(initialPath ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Reset to the initial location each time the browser is (re)opened — the render-time "reset state when
  // a prop changes" pattern (react-hooks/set-state-in-effect forbids doing this from an effect), same as
  // LibraryView's toolbar reset.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setCurrentPath(initialPath ?? "");
      setExpanded(new Set());
    }
  }

  const content = useBrowseDir(currentPath, open && currentPath.length > 0);
  const segments = pathSegments(currentPath);

  const navigate = (path: string) => setCurrentPath(path);
  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const footer = (
    <>
      <span className="text-dim min-w-0 truncate font-mono text-xs">
        {currentPath ? t("browser.selected", { path: currentPath }) : t("browser.pickHint")}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" onClick={onClose} className="px-3 py-1.5 text-xs">
          {t("common.cancel")}
        </Button>
        <Button
          accent="green"
          onClick={() => {
            onChoose(currentPath);
            onClose();
          }}
          disabled={currentPath.length === 0}
          className="px-4 py-1.5 text-xs"
        >
          {t("browser.choose")}
        </Button>
      </div>
    </>
  );

  return (
    <Dialog open={open} onClose={onClose} heading={t("browser.title")} footer={footer}>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(200px,240px)_1fr] gap-3 pb-4">
        {/* TREE */}
        <div className="bg-deep/40 hud-clip-sm min-h-0 overflow-auto p-1.5">
          {roots.isPending ? (
            <p className="text-dim flex items-center gap-1.5 p-2 text-xs">
              <Loader2 size={12} strokeWidth={2} className="animate-spin" aria-hidden />
              {t("common.loading")}
            </p>
          ) : roots.isError ? (
            <p className="text-danger p-2 text-xs">{errorMessage(roots.error)}</p>
          ) : (
            <ul>
              {roots.data?.map((root) => {
                const key = rootLabelKey(root.kind);
                return (
                  <TreeNode
                    key={root.path}
                    label={key ? t(key) : root.label}
                    icon={<RootIcon kind={root.kind} />}
                    path={root.path}
                    depth={0}
                    currentPath={currentPath}
                    expanded={expanded}
                    onNavigate={navigate}
                    onToggle={toggle}
                  />
                );
              })}
            </ul>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex min-h-0 flex-col gap-2">
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-0.5 text-xs">
            {segments.length === 0 ? (
              <span className="text-dim">{t("browser.pickHint")}</span>
            ) : (
              segments.map((seg, i) => (
                <span key={seg.path} className="flex items-center gap-0.5">
                  {i > 0 ? (
                    <ChevronRight size={11} className="text-dim/50 shrink-0" aria-hidden />
                  ) : null}
                  <Button
                    variant="ghost"
                    active={i === segments.length - 1}
                    onClick={() => navigate(seg.path)}
                    className="max-w-[220px] truncate px-1 py-0.5 text-xs"
                  >
                    {seg.label}
                  </Button>
                </span>
              ))
            )}
          </div>

          {/* Subfolder list */}
          <div className="bg-deep/40 hud-clip-sm min-h-0 flex-1 overflow-auto p-1.5">
            {currentPath.length === 0 ? (
              <p className="text-dim/70 p-3 text-xs italic">{t("browser.pickHint")}</p>
            ) : content.isPending ? (
              <p className="text-dim flex items-center gap-1.5 p-3 text-xs">
                <Loader2 size={12} strokeWidth={2} className="animate-spin" aria-hidden />
                {t("common.loading")}
              </p>
            ) : content.isError ? (
              <p className="text-danger flex items-start gap-1.5 p-3 text-xs">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                {t("browser.error")}
              </p>
            ) : content.data && content.data.length > 0 ? (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1">
                {content.data.map((child) => (
                  <li key={child.path}>
                    <Button
                      variant="ghost"
                      onClick={() => navigate(child.path)}
                      className="flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-xs"
                    >
                      <Folder size={15} className="shrink-0" aria-hidden />
                      <span className="truncate">{child.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-dim/70 p-3 text-xs italic">{t("browser.emptyHere")}</p>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
