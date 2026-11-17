import { useMutation, useQueryClient } from "@tanstack/react-query"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"

export function useDeleteQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteQuack,
    onSuccess: async () => {
      // A quack with replies stays as a placeholder and anything else goes,
      // and only the server knows which, so the lists and replies are refetched
      // rather than edited here. The dialog waits for that.
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
