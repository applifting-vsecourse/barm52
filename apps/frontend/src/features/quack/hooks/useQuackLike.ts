import { useMutation, useQueryClient } from "@tanstack/react-query"

import { setQuackLike } from "@/features/quack/api/likeApi"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"

export function useQuackLike(quackId: string) {
  const queryClient = useQueryClient()
  const filter = { queryKey: quackKeys.all() }

  return useMutation({
    mutationFn: (shouldLike: boolean) => setQuackLike({ quackId, shouldLike }),
    onSuccess: async (likes) => {
      // A fetch that started before the mutation can still carry the old count.
      await queryClient.cancelQueries(filter)
      queryClient.setQueriesData<Quack[]>(filter, (quacks) =>
        quacks?.map((quack) =>
          quack.id === quackId && !quack.deleted ? { ...quack, likes } : quack,
        ),
      )
    },
    onSettled: () => queryClient.invalidateQueries(filter),
  })
}
