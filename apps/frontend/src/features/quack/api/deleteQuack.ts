import { api, HTTPError } from "@/lib/api-client"

// A quack that is already gone (deleted in another tab, say) is what the user
// asked for, so a 404 counts as done rather than as a failure.
export async function deleteQuack(quackId: string): Promise<void> {
  try {
    await api.delete(`quacks/${encodeURIComponent(quackId)}`)
  } catch (error) {
    if (error instanceof HTTPError && error.response.status === 404) return
    throw error
  }
}
