import { useMutation, useQueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { addReply } from "@/features/quack/api/replies"

export function useAddReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addReply,
    onSuccess: async () => {
      // The replies and the reply count in the lists both change.
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
