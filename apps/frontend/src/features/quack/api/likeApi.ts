import { api } from "@/lib/api-client"

import { likeSummarySchema, type LikeSummary } from "@/features/quack/api/quackSchemas"

export async function setQuackLike({
  quackId,
  shouldLike,
}: {
  quackId: string
  shouldLike: boolean
}): Promise<LikeSummary> {
  const response = await api(`quacks/${encodeURIComponent(quackId)}/like`, {
    method: shouldLike ? "PUT" : "DELETE",
  }).json()
  return likeSummarySchema.parse(response)
}
