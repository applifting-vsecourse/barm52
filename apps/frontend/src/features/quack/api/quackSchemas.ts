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

// Mirror the server's poll rules and settings. The server validates independently.
export const MIN_POLL_OPTIONS = 2
export const MAX_POLL_OPTIONS = 10
export const MAX_POLL_OPTION_LENGTH = 80
export const POLL_LENGTHS = ["1h", "1d", "7d", "none"] as const
export const POLL_RESULTS_VISIBILITIES = ["immediately", "after_vote"] as const
export const POLL_SUGGESTION_MODES = ["not_allowed", "published", "author_approves"] as const

export type PollLength = (typeof POLL_LENGTHS)[number]
export type PollResultsVisibility = (typeof POLL_RESULTS_VISIBILITIES)[number]
export type PollSuggestionMode = (typeof POLL_SUGGESTION_MODES)[number]

// A poll as the signed-in user may see it. When they may not see results yet,
// the server leaves every number out: `votes` and `totalVotes` are null.
export const pollSchema = z.object({
  endsAt: z.coerce.date().nullable(),
  ended: z.boolean(),
  resultsVisibility: z.enum(POLL_RESULTS_VISIBILITIES),
  suggestions: z.enum(POLL_SUGGESTION_MODES),
  isAuthor: z.boolean(),
  resultsVisible: z.boolean(),
  totalVotes: z.number().int().nullable(),
  myVoteOptionId: z.string().nullable(),
  canSuggest: z.boolean(),
  options: z.array(
    z.object({ id: z.string(), text: z.string(), votes: z.number().int().nullable() }),
  ),
  pendingSuggestions: z.array(z.object({ id: z.string(), text: z.string() })),
})

export type Poll = z.infer<typeof pollSchema>

export const quackSchema = z.object({
  id: z.string(),
  text: z.string(),
  // The author may leave the mood out; the server sends null for those quacks.
  mood: moodSchema.nullable(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  user: quackUserSchema,
  // The quack text is the poll's question. Null for a quack without a poll.
  poll: pollSchema.nullable().default(null),
})

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>
