import { z } from "zod"

import { MOODS } from "@/lib/moods"

// Mirror the server's rules (BetterAuth's for the username) so mistakes show
// under the field before the request. The server validates independently.
export const MIN_USERNAME_LENGTH = 3
export const MAX_USERNAME_LENGTH = 30
export const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/
export const MAX_DISPLAY_NAME_LENGTH = 50
export const MAX_BIO_LENGTH = 160

export const settingsSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  defaultMood: z.enum(MOODS).nullable(),
})

export type Settings = z.infer<typeof settingsSchema>
