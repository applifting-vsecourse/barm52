// The feed reads quacks through this schema, and zod drops any key it doesn't
// know — so a mood missing here would vanish silently after every reload.
import { describe, expect, it } from "vitest"

import { MOODS, quacksSchema } from "@/features/quack/api/quackSchemas"

const payload = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  userId: "u1",
  createdAt: "2026-01-01T12:00:00.000Z",
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

describe("quacksSchema", () => {
  it.each(MOODS)("keeps the %s mood the API sent", (mood) => {
    expect(quacksSchema.parse([payload({ mood })])[0]?.mood).toBe(mood)
  })

  it("keeps a quack without a mood as null", () => {
    expect(quacksSchema.parse([payload({ mood: null })])[0]?.mood).toBeNull()
  })

  it("rejects a mood it doesn't know", () => {
    expect(quacksSchema.safeParse([payload({ mood: "ecstatic" })]).success).toBe(false)
  })
})
