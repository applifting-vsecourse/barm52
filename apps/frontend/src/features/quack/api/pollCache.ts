import type { QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"

// Puts the server's latest word on a poll into every cached list that shows its
// quack: the feed and any search results alike.
export function setPollInLists(queryClient: QueryClient, quackId: string, poll: Poll) {
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (quacks) =>
    quacks?.map((quack) => (quack.id === quackId ? { ...quack, poll } : quack)),
  )
}
