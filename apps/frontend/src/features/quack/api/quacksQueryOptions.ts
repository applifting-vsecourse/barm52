import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

// `search` is the trimmed text to look for. Empty means the whole feed, and then
// no search is sent at all. `isMine` keeps only the signed-in user's quacks; the
// server knows who that is from the session, so no user id is sent.
export const quacksQueryOptions = (search = "", isMine = false) =>
  queryOptions({
    queryKey: quackKeys.list(search, isMine),
    queryFn: async () =>
      quacksSchema.parse(
        await api
          .get("quacks", {
            searchParams: {
              ...(search ? { q: search } : {}),
              ...(isMine ? { mine: "true" } : {}),
            },
          })
          .json(),
      ),
    // While the next search loads, keep showing the last results rather than
    // flashing an empty list between keystrokes. Not across All and Mine,
    // though: everybody's quacks must never pass for yours, even briefly.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2].isMine === isMine ? keepPreviousData(previous) : undefined,
  })
