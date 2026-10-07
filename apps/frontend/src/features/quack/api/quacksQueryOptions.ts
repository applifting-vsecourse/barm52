import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// `search` is the trimmed text to look for. Empty means the whole feed, and then
// no search is sent at all.
export const quacksQueryOptions = (search = "") =>
  queryOptions({
    queryKey: quackKeys.list(search),
    queryFn: async () =>
      quacksSchema.parse(
        await api.get("quacks", { searchParams: search ? { q: search } : undefined }).json(),
      ),
    // While the next search loads, keep showing the last results rather than
    // flashing an empty list between keystrokes.
    placeholderData: keepPreviousData,
  })
