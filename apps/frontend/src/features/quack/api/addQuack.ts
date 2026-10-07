import { api } from "@/lib/api-client"

import { quackSchema, type Mood, type Quack } from "@/features/quack/api/quackSchemas"

export async function addQuack(input: { text: string; mood?: Mood }): Promise<Quack> {
  const json = await api.post("quacks", { json: input }).json()
  return quackSchema.parse(json)
}
