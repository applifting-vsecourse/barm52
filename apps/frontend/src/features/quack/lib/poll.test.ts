import { describe, expect, it } from "vitest"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { applyChoice, formatVotes, percent } from "@/features/quack/lib/poll"

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  endsAt: null,
  ended: false,
  resultsVisibility: "immediately",
  suggestions: "not_allowed",
  isAuthor: false,
  resultsVisible: true,
  totalVotes: 3,
  myVoteOptionId: null,
  canSuggest: false,
  options: [
    { id: "a", text: "Pizza", votes: 2 },
    { id: "b", text: "Sushi", votes: 1 },
  ],
  pendingSuggestions: [],
  ...overrides,
})

describe("percent", () => {
  it.each([
    [0, 0, 0],
    [3, 0, 0],
    [1, 8, 13], // 12.5 rounds up
    [1, 3, 33],
    [2, 3, 67],
    [1, 200, 1], // 0.5 rounds up
    [3, 3, 100],
  ])("%i of %i is %i%%", (votes, total, expected) => {
    expect(percent(votes, total)).toBe(expected)
  })
})

describe("formatVotes", () => {
  it.each([
    [0, "0 votes"],
    [1, "1 vote"],
    [2, "2 votes"],
  ])("%i reads %s", (count, text) => {
    expect(formatVotes(count)).toBe(text)
  })
})

describe("applyChoice", () => {
  it("counts a first vote and the total (C1)", () => {
    const poll = applyChoice(aPoll(), "b")

    expect(poll.myVoteOptionId).toBe("b")
    expect(poll.options.map((o) => o.votes)).toEqual([2, 2])
    expect(poll.totalVotes).toBe(4)
  })

  it("moves a vote without changing the total (C2)", () => {
    const poll = applyChoice(aPoll({ myVoteOptionId: "a" }), "b")

    expect(poll.options.map((o) => o.votes)).toEqual([1, 2])
    expect(poll.totalVotes).toBe(3)
  })

  it("changes nothing for the answer already chosen (C3)", () => {
    const poll = aPoll({ myVoteOptionId: "a" })

    expect(applyChoice(poll, "a")).toBe(poll)
  })

  it("moves only the choice while results are hidden (X2.5)", () => {
    const hidden = aPoll({
      resultsVisible: false,
      totalVotes: null,
      options: [
        { id: "a", text: "Pizza", votes: null },
        { id: "b", text: "Sushi", votes: null },
      ],
    })

    const poll = applyChoice(hidden, "a")

    expect(poll.myVoteOptionId).toBe("a")
    expect(poll.totalVotes).toBeNull()
    expect(poll.options.map((o) => o.votes)).toEqual([null, null])
  })
})
