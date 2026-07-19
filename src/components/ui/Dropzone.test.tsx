import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { Dropzone, type DropzoneProps } from "./Dropzone";
import { settingsDto } from "../../test/settings";

vi.mock("../../api/commands", () => ({
  api: { getSettings: vi.fn() },
}));

import { api } from "../../api/commands";

type DragDropHandler = (event: {
  payload:
    | { type: "enter"; paths: string[] }
    | { type: "over" }
    | { type: "drop"; paths: string[] }
    | { type: "leave" };
}) => void;

let capturedHandler: DragDropHandler | undefined;
const unlistenMock = vi.fn();
const onDragDropEventMock = vi.fn((handler: DragDropHandler) => {
  capturedHandler = handler;
  return Promise.resolve(unlistenMock);
});

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: onDragDropEventMock }),
}));

function renderDropzone(props: Partial<DropzoneProps> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onFolderDropped = props.onFolderDropped ?? vi.fn();
  const onBrowse = props.onBrowse ?? vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const utils = render(
    <Dropzone {...props} onFolderDropped={onFolderDropped} onBrowse={onBrowse} />,
    { wrapper },
  );
  return { ...utils, onFolderDropped, onBrowse };
}

describe("Dropzone", () => {
  beforeEach(() => {
    vi.mocked(api.getSettings).mockReset();
    vi.mocked(api.getSettings).mockResolvedValue(settingsDto());
    onDragDropEventMock.mockClear();
    unlistenMock.mockClear();
    capturedHandler = undefined;
  });

  it("renders the default label and a Browse button", async () => {
    renderDropzone();
    expect(await screen.findByText("Ordner hierher ziehen oder durchsuchen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Durchsuchen…" })).toBeInTheDocument();
  });

  it("renders custom children instead of the default label", () => {
    renderDropzone({ children: <p>/home/user/videos</p> });
    expect(screen.getByText("/home/user/videos")).toBeInTheDocument();
  });

  it("calls onBrowse when the Browse button is clicked", () => {
    const { onBrowse } = renderDropzone();
    fireEvent.click(screen.getByRole("button", { name: "Durchsuchen…" }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it("subscribes to the webview drag-drop event on mount", async () => {
    renderDropzone();
    await waitFor(() => expect(onDragDropEventMock).toHaveBeenCalledTimes(1));
  });

  it("calls onFolderDropped with the first dropped path", async () => {
    const { onFolderDropped } = renderDropzone();
    await waitFor(() => expect(capturedHandler).toBeDefined());

    capturedHandler?.({ payload: { type: "drop", paths: ["/videos/a", "/videos/b"] } });

    expect(onFolderDropped).toHaveBeenCalledWith("/videos/a");
  });

  it("ignores a drop with no paths", async () => {
    const { onFolderDropped } = renderDropzone();
    await waitFor(() => expect(capturedHandler).toBeDefined());

    capturedHandler?.({ payload: { type: "drop", paths: [] } });

    expect(onFolderDropped).not.toHaveBeenCalled();
  });

  it("unlistens on unmount", async () => {
    const { unmount } = renderDropzone();
    await waitFor(() => expect(onDragDropEventMock).toHaveBeenCalledTimes(1));

    unmount();

    await waitFor(() => expect(unlistenMock).toHaveBeenCalledOnce());
  });
});
