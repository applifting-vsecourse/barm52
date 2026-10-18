import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

// The server refused because the poll had ended. The UI shows that instead of a
// generic failure.
export class PollEndedError extends Error {
  constructor() {
    super("This poll has ended.")
    this.name = "PollEndedError"
  }
}

// The server marks "the poll has ended" with a 409 whose body says
// reason: "poll_ended". Anything else is passed on as it is.
async function asPollError(error: unknown): Promise<unknown> {
  const response = (error as { response?: Response } | null)?.response
  if (response?.status === 409) {
    try {
      const body = (await response.clone().json()) as { reason?: string }
      if (body.reason === "poll_ended") return new PollEndedError()
    } catch {
      // no JSON body: not ours to interpret
    }
  }
  return error
}

async function pollRequest(request: () => Promise<unknown>): Promise<Poll> {
  try {
    return pollSchema.parse(await request())
  } catch (error) {
    throw await asPollError(error)
  }
}

const pollPath = (quackId: string) => `quacks/${encodeURIComponent(quackId)}/poll`

export const votePoll = (quackId: string, optionId: string) =>
  pollRequest(() => api.put(`${pollPath(quackId)}/vote`, { json: { optionId } }).json())

export const suggestPollOption = (quackId: string, text: string) =>
  pollRequest(() => api.post(`${pollPath(quackId)}/options`, { json: { text } }).json())

export const approvePollSuggestion = (quackId: string, optionId: string) =>
  pollRequest(() =>
    api.post(`${pollPath(quackId)}/options/${encodeURIComponent(optionId)}/approve`).json(),
  )

export const rejectPollSuggestion = (quackId: string, optionId: string) =>
  pollRequest(() =>
    api.delete(`${pollPath(quackId)}/options/${encodeURIComponent(optionId)}`).json(),
  )
