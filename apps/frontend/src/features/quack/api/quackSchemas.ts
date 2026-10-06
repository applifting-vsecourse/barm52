import { z } from "zod"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

// Mirrors the server's list of moods. The server validates independently.
export const MOODS = ["happy", "sad", "angry", "silly"] as const
export const moodSchema = z.enum(MOODS)

export type Mood = z.infer<typeof moodSchema>

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  // The author may leave the mood out; the server sends null for those quacks.
  mood: moodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
