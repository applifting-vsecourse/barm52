// The one list of moods on the frontend, mirroring the server's. Shared by the
// quack feed (a quack's mood) and settings (the default mood for new quacks).
// The server validates independently.
export const MOODS = ["happy", "sad", "angry", "silly"] as const

export type Mood = (typeof MOODS)[number]
