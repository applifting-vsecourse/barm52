import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { QuackFeed } from "@/features/quack/components/QuackFeed"
import { settingsQueryOptions } from "@/features/settings/api/settingsQueryOptions"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  // The post form starts from the default mood in the user's settings. A
  // prefetch rather than a requirement: if settings fail to load, the feed
  // still works and a quack simply starts without a mood.
  loader: ({ context }) => context.queryClient.prefetchQuery(settingsQueryOptions()),
  component: QuacksPage,
})

function QuacksPage() {
  const { data: settings } = useQuery(settingsQueryOptions())

  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackFeed defaultMood={settings?.defaultMood ?? null} />
      </section>
    </>
  )
}
