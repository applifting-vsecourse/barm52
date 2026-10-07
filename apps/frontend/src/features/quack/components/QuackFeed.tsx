import { useRef } from "react"
import { useQuery } from "@tanstack/react-query"

import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"
import { useQuackSearch } from "@/features/quack/hooks/useQuackSearch"

export function QuackFeed() {
  const { text, setText, search, isSearch, clear } = useQuackSearch()
  const searchInput = useRef<HTMLInputElement>(null)
  const quacksQuery = useQuery(quacksQueryOptions(search))

  // A failed refetch keeps the last results around. For a search, show the
  // error alone rather than results that may no longer match.
  const quacks = isSearch && quacksQuery.error ? [] : (quacksQuery.data ?? [])

  return (
    <>
      {/* A quack that was posted should be seen, so posting ends the search. */}
      <QuackForm
        className="mb-4"
        onPosted={clear}
      />

      <QuackSearch
        className="mb-4"
        value={text}
        onChange={setText}
        inputRef={searchInput}
      />

      <QuackList
        quacks={quacks}
        // While the next search loads the previous results stay on screen, and
        // neither empty state shows until the new ones arrive.
        isLoading={quacksQuery.isLoading || quacksQuery.isPlaceholderData}
        error={quacksQuery.error ?? undefined}
        search={isSearch ? search : undefined}
        onClearSearch={() => {
          clear()
          // The button disappears with the empty result, so focus has to go
          // somewhere on purpose.
          searchInput.current?.focus()
        }}
        // Only the error state offers a retry — posting invalidates the list,
        // and refocusing the tab refetches it.
        onReload={() => void quacksQuery.refetch()}
      />
    </>
  )
}
