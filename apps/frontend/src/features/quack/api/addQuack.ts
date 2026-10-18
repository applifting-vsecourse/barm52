import { api } from "@/lib/api-client"

import {
  quackSchema,
  type Mood,
  type PollLength,
  type PollResultsVisibility,
  type PollSuggestionMode,
  type Quack,
} from "@/features/quack/api/quackSchemas"

export type NewPoll = {
  options: string[]
  length: PollLength
  results: PollResultsVisibility
  suggestions: PollSuggestionMode
}

export async function addQuack(input: {
  text: string
  mood?: Mood
  poll?: NewPoll
}): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}
