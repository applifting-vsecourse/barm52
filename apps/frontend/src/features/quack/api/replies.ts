import { api } from "@/lib/api-client"

import { quackSchema, quacksSchema, type Quack } from "@/features/quack/api/quackSchemas"

const repliesPath = (quackId: string) => `quacks/${encodeURIComponent(quackId)}/replies`

export async function getReplies(quackId: string): Promise<Quack[]> {
  return quacksSchema.parse(await api.get(repliesPath(quackId)).json())
}

export async function addReply(input: { quackId: string; text: string }): Promise<Quack> {
  return quackSchema.parse(
    await api.post(repliesPath(input.quackId), { json: { text: input.text } }).json(),
  )
}
