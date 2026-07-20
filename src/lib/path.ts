// Pure, cross-platform path helpers for the folder browser's breadcrumb (ADR-PROJ-001). Paths arrive
// from the backend as the OS produced them — Windows with `\` and a drive letter, everything else with
// `/` — so these tolerate both separators rather than assuming one.

export interface PathSegment {
  /** What to show for this segment (a folder name, or the drive/root itself). */
  label: string;
  /** The absolute path up to and including this segment — where a click on it navigates. */
  path: string;
}

/**
 * Split an absolute path into clickable breadcrumb segments, each carrying the absolute path up to it.
 * Handles a Windows drive path (`C:\Users\steve` → `C:\` / `Users` / `steve`) and a POSIX path
 * (`/home/steve` → `/` / `home` / `steve`). An empty string yields no segments.
 */
export function pathSegments(path: string): PathSegment[] {
  if (!path) return [];

  const winDrive = /^([a-zA-Z]:)[\\/]?(.*)$/.exec(path);
  if (winDrive) {
    const drive = winDrive[1]; // "C:"
    const rest = winDrive[2].split(/[\\/]+/).filter(Boolean);
    const segments: PathSegment[] = [{ label: `${drive}\\`, path: `${drive}\\` }];
    let acc = `${drive}\\`;
    for (const part of rest) {
      acc = acc.endsWith("\\") ? `${acc}${part}` : `${acc}\\${part}`;
      segments.push({ label: part, path: acc });
    }
    return segments;
  }

  // POSIX: an absolute path starts at the root "/".
  const parts = path.split("/").filter(Boolean);
  const segments: PathSegment[] = [{ label: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc = `${acc}/${part}`;
    segments.push({ label: part, path: acc });
  }
  return segments;
}
