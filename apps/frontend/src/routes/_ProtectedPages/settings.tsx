import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { settingsQueryOptions } from "@/features/settings/api/settingsQueryOptions"
import { SettingsForm } from "@/features/settings/components/SettingsForm"

export const Route = createFileRoute("/_ProtectedPages/settings")({
  // The form starts from the saved settings, so they are loaded first.
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueryOptions()),
  component: SettingsPage,
})

function SettingsPage() {
  const { data: settings } = useSuspenseQuery(settingsQueryOptions())

  return (
    <>
      <Seo title="Settings" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

        <SettingsForm settings={settings} />
      </section>
    </>
  )
}
