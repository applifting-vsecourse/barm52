import { useMutation, useQueryClient } from "@tanstack/react-query"

import { settingsKeys } from "@/features/settings/api/settingsKeys"
import { updateSettings } from "@/features/settings/api/updateSettings"

// The hook owns the mutation only; form state belongs to react-hook-form in the
// component, the same way the quack form does it.
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSettings,
    onSuccess: async (saved) => {
      queryClient.setQueryData(settingsKeys.all(), saved)
      // The name and username show across the app: in the header (the session)
      // and on every quack in any list. Refetch everything, so all of it
      // follows at once without this feature reaching into the others.
      await queryClient.invalidateQueries()
    },
  })
}
