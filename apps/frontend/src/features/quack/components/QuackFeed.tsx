import { useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { Mood } from "@/features/quack/api/quackSchemas"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackList } from "@/features/quack/components/QuackList"
import { QuackSearch } from "@/features/quack/components/QuackSearch"
import { useQuackSearch } from "@/features/quack/hooks/useQuackSearch"

type FeedTab = "all" | "mine"

type QuackFeedProps = {
  // Preselected in the post form; comes from the user's settings.
  defaultMood?: Mood | null
  // The signed-in user, from the session. Their own quacks can be deleted.
  currentUserId?: string
}

export function QuackFeed({ defaultMood, currentUserId }: QuackFeedProps = {}) {
  const { text, setText, search, isSearch, clear } = useQuackSearch()
  const [tab, setTab] = useState<FeedTab>("all")
  const searchInput = useRef<HTMLInputElement>(null)
  const newQuackInput = useRef<HTMLTextAreaElement>(null)
  const quacksQuery = useQuery(quacksQueryOptions(search, tab === "mine"))

  // A failed refetch keeps the last results around. For a search, show the
  // error alone rather than results that may no longer match.
  const quacks = isSearch && quacksQuery.error ? [] : (quacksQuery.data ?? [])

  return (
    <>
      {/* A quack that was posted should be seen, so posting ends the search. */}
      <QuackForm
        className="mb-4"
        defaultMood={defaultMood}
        onPosted={clear}
        inputRef={newQuackInput}
      />

      <QuackSearch
        className="mb-4"
        value={text}
        onChange={setText}
        inputRef={searchInput}
      />

      {/* The search applies within the tab: Mine searches only your quacks. */}
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as FeedTab)}
        className="gap-4"
      >
        <TabsList aria-label="Whose quacks">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
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
            currentUserId={currentUserId}
            isMine={tab === "mine"}
            onWriteFirst={() => newQuackInput.current?.focus()}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
