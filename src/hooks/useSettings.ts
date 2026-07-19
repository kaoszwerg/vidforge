import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/commands";

/** Read the persisted user settings (async/server state owned by TanStack Query, cached 60s). */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    staleTime: 60_000,
  });
}

/** Options accepted by {@link useUpdateSettings} — a partial update; omitted fields keep their
 * current persisted value (mirrors the backend's own partial-update semantics). */
export type UpdateSettingsOptions = Parameters<typeof api.updateSettings>[0];

/** Mutate user settings; writes the returned state straight into the settings query cache. */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: UpdateSettingsOptions) => api.updateSettings(opts),
    onSuccess: (data) => qc.setQueryData(["settings"], data),
  });
}
