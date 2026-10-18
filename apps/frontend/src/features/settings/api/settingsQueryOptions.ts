import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { settingsKeys } from "@/features/settings/api/settingsKeys"
import { settingsSchema } from "@/features/settings/api/settingsSchemas"

export const settingsQueryOptions = () =>
  queryOptions({
    queryKey: settingsKeys.all(),
    queryFn: async () => settingsSchema.parse(await api.get("settings").json()),
  })
