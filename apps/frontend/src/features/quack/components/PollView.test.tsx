// Voting as the reader experiences it, through the real feed: the click shows at
// once, the server's answer replaces the guess, a failure puts things back and
// says so next to the poll. The API is faked so each answer can be held back.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import { QuackFeed } from "@/features/quack/components/QuackFeed"

vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

type WirePoll = ReturnType<typeof wirePoll>

const wirePoll = (overrides: Record<string, unknown> = {}) => ({
  endsAt: null as string | null,
  ended: false,
  resultsVisibility: "immediately",
  suggestions: "not_allowed",
  isAuthor: false,
  resultsVisible: true,
  totalVotes: 3 as number | null,
  myVoteOptionId: null as string | null,
  canSuggest: false,
  options: [
    { id: "a", text: "Pizza", votes: 2 as number | null },
    { id: "b", text: "Sushi", votes: 1 as number | null },
  ],
  pendingSuggestions: [] as { id: string; text: string }[],
  ...overrides,
})

const wireQuack = (id: string, poll: WirePoll) => ({
  id,
  text: `Lunch? ${id}`,
  mood: null,
  userId: "author",
  createdAt: "2026-10-18T12:00:00.000Z",
  user: { id: "author", name: "Pond Admin", username: "PondAdmin" },
  poll,
})

type Deferred = {
  path: string
  optionId: string
  resolve: (poll: WirePoll) => void
  reject: (error: unknown) => void
}

// The fake server: what a list load returns, and every vote request held until
// the test answers it.
let feed: ReturnType<typeof wireQuack>[]
let votes: Deferred[]

const httpError = (status: number, body: unknown) => ({
  name: "HTTPError",
  message: `Request failed with status code ${status}`,
  response: new Response(JSON.stringify(body), { status }),
})

beforeEach(() => {
  feed = [wireQuack("q1", wirePoll())]
  votes = []
  vi.mocked(api.get).mockReset()
  vi.mocked(api.put).mockReset()
  vi.mocked(api.get).mockImplementation((() => ({
    json: () => Promise.resolve(structuredClone(feed)),
  })) as never)
  vi.mocked(api.put).mockImplementation(((
    path: string,
    options: { json: { optionId: string } },
  ) => ({
    json: () =>
      new Promise((resolve, reject) => {
        votes.push({ path, optionId: options.json.optionId, resolve, reject })
      }),
  })) as never)
})

const renderFeed = async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuackFeed />
    </QueryClientProvider>,
  )
  await screen.findByRole("button", { name: /Pizza/ })
  return user
}

const answer = (text: string, scope: HTMLElement = document.body) =>
  within(scope).getByRole("button", { name: new RegExp(text) })

// The vote request number `index`, which must have been sent.
const vote = (index: number): Deferred => {
  const request = votes[index]
  if (!request) throw new Error(`vote request #${index} was never sent`)
  return request
}

// The server records a vote: the feed it serves from now on agrees.
const serverAnswers = (vote: Deferred, poll: WirePoll) => {
  feed = [wireQuack("q1", poll)]
  vote.resolve(poll)
}

describe("a poll in the feed", () => {
  it("shows each answer's count, percentage and bar, and the total (B2, B3)", async () => {
    await renderFeed()

    expect(answer("Pizza")).toHaveTextContent("2 votes · 67%")
    expect(answer("Sushi")).toHaveTextContent("1 vote · 33%")
    expect(screen.getByText("3 votes")).toBeInTheDocument()
    expect(answer("Pizza").querySelector("[aria-hidden][style]")).toHaveStyle({ width: "67%" })
  })

  it("marks the reader's vote with a check and words, not colour alone (B4, B7)", async () => {
    feed = [wireQuack("q1", wirePoll({ myVoteOptionId: "b" }))]
    await renderFeed()

    expect(answer("Sushi")).toHaveAttribute("aria-pressed", "true")
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "false")
    expect(within(answer("Sushi")).getByText("Your vote")).toHaveClass("sr-only")
    expect(answer("Sushi").tagName).toBe("BUTTON")
  })

  it('shows "0 votes" and 0% when nobody has voted', async () => {
    feed = [
      wireQuack(
        "q1",
        wirePoll({
          totalVotes: 0,
          options: [
            { id: "a", text: "Pizza", votes: 0 },
            { id: "b", text: "Sushi", votes: 0 },
          ],
        }),
      ),
    ]
    await renderFeed()

    expect(screen.getByText("0 votes")).toBeInTheDocument()
    expect(answer("Pizza")).toHaveTextContent("0 votes · 0%")
  })
})

describe("voting", () => {
  it("shows the vote at once, before the server answers (C1, D1)", async () => {
    const user = await renderFeed()

    await user.click(answer("Sushi"))

    expect(votes).toHaveLength(1)
    expect(vote(0).path).toBe("quacks/q1/poll/vote")
    expect(answer("Sushi")).toHaveAttribute("aria-pressed", "true")
    expect(answer("Sushi")).toHaveTextContent("2 votes · 50%")
    expect(answer("Pizza")).toHaveTextContent("2 votes · 50%")
    expect(screen.getByText("4 votes")).toBeInTheDocument()
  })

  it("then shows the server's numbers, other people's votes included (D2)", async () => {
    const user = await renderFeed()
    await user.click(answer("Sushi"))

    serverAnswers(
      vote(0),
      wirePoll({
        myVoteOptionId: "b",
        totalVotes: 6,
        options: [
          { id: "a", text: "Pizza", votes: 3 },
          { id: "b", text: "Sushi", votes: 3 },
        ],
      }),
    )

    await waitFor(() => expect(screen.getByText("6 votes")).toBeInTheDocument())
    expect(answer("Sushi")).toHaveTextContent("3 votes · 50%")
    expect(answer("Sushi")).toHaveAttribute("aria-pressed", "true")
  })

  it("moves a vote without changing the total (C2)", async () => {
    feed = [wireQuack("q1", wirePoll({ myVoteOptionId: "a" }))]
    const user = await renderFeed()

    await user.click(answer("Sushi"))

    expect(answer("Pizza")).toHaveTextContent("1 vote · 33%")
    expect(answer("Sushi")).toHaveTextContent("2 votes · 67%")
    expect(screen.getByText("3 votes")).toBeInTheDocument()
  })

  it("sends nothing for the answer already chosen (C3)", async () => {
    feed = [wireQuack("q1", wirePoll({ myVoteOptionId: "a" }))]
    const user = await renderFeed()

    await user.click(answer("Pizza"))

    expect(votes).toHaveLength(0)
    expect(answer("Pizza")).toHaveTextContent("2 votes · 67%")
  })

  it("lets the last of quick clicks win, on the server and on screen (D3)", async () => {
    const user = await renderFeed()

    await user.click(answer("Sushi"))
    await user.click(answer("Pizza"))

    // One at a time, so the server can't receive them out of order.
    expect(votes).toHaveLength(1)
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true")
    expect(answer("Pizza")).toHaveTextContent("3 votes · 75%")

    vote(0).resolve(
      wirePoll({
        myVoteOptionId: "b",
        totalVotes: 4,
        options: [
          { id: "a", text: "Pizza", votes: 2 },
          { id: "b", text: "Sushi", votes: 2 },
        ],
      }),
    )
    await waitFor(() => expect(votes).toHaveLength(2))
    expect(vote(1).optionId).toBe("a")
    // Still the last click on screen, not the first one the server confirmed.
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true")

    serverAnswers(
      vote(1),
      wirePoll({
        myVoteOptionId: "a",
        totalVotes: 4,
        options: [
          { id: "a", text: "Pizza", votes: 3 },
          { id: "b", text: "Sushi", votes: 1 },
        ],
      }),
    )
    await waitFor(() => expect(answer("Pizza")).toHaveTextContent("3 votes · 75%"))
    expect(answer("Sushi")).toHaveTextContent("1 vote · 25%")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows no error when only an earlier click failed (D3)", async () => {
    const user = await renderFeed()
    await user.click(answer("Sushi"))
    await user.click(answer("Pizza"))

    vote(0).reject(new Error("network down"))
    await waitFor(() => expect(votes).toHaveLength(2))
    serverAnswers(
      vote(1),
      wirePoll({
        myVoteOptionId: "a",
        totalVotes: 4,
        options: [
          { id: "a", text: "Pizza", votes: 3 },
          { id: "b", text: "Sushi", votes: 1 },
        ],
      }),
    )

    await waitFor(() => expect(screen.getByText("4 votes")).toBeInTheDocument())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("a vote that fails", () => {
  it("puts back exactly what was there and says so at the poll (E1)", async () => {
    feed = [wireQuack("q1", wirePoll({ myVoteOptionId: "a" }))]
    const user = await renderFeed()
    await user.click(answer("Sushi"))

    vote(0).reject(httpError(500, { message: "Internal server error" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Your vote wasn't saved. Try again.")
    expect(answer("Pizza")).toHaveAttribute("aria-pressed", "true")
    expect(answer("Pizza")).toHaveTextContent("2 votes · 67%")
    expect(answer("Sushi")).toHaveTextContent("1 vote · 33%")
    expect(screen.getByText("3 votes")).toBeInTheDocument()
  })

  it("keeps the error until the reader votes again (E2)", async () => {
    const user = await renderFeed()
    await user.click(answer("Sushi"))
    vote(0).reject(httpError(400, { message: "Bad request" }))
    await screen.findByRole("alert")

    await user.click(answer("Sushi"))

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(votes).toHaveLength(2)
  })

  it("says the poll has ended instead, and stops offering answers (E3, X1.3)", async () => {
    const user = await renderFeed()
    await user.click(answer("Sushi"))

    feed = [wireQuack("q1", wirePoll({ ended: true, endsAt: "2026-10-18T11:00:00.000Z" }))]
    vote(0).reject(httpError(409, { message: "This poll has ended.", reason: "poll_ended" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("This poll has ended.")
    expect(screen.queryByRole("button", { name: /Pizza/ })).not.toBeInTheDocument()
    expect(screen.getByText("Pizza")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("Ended")).toBeInTheDocument())
  })

  it("leaves other polls in the feed alone (E4)", async () => {
    feed = [
      wireQuack("q1", wirePoll()),
      wireQuack(
        "q2",
        wirePoll({
          options: [
            { id: "c", text: "Tea", votes: 1 },
            { id: "d", text: "Coffee", votes: 0 },
          ],
          totalVotes: 1,
        }),
      ),
    ]
    const user = await renderFeed()
    await user.click(answer("Sushi"))

    vote(0).reject(new Error("network down"))

    await screen.findByRole("alert")
    expect(screen.getAllByRole("alert")).toHaveLength(1)
    const [first, second] = screen.getAllByRole("article")
    expect(within(first!).getByRole("alert")).toBeInTheDocument()
    expect(within(second!).queryByRole("alert")).not.toBeInTheDocument()
    expect(answer("Coffee", second)).toHaveTextContent("0 votes · 0%")
  })
})

describe("results after voting (X2)", () => {
  const hidden = () =>
    wirePoll({
      resultsVisibility: "after_vote",
      resultsVisible: false,
      totalVotes: null,
      options: [
        { id: "a", text: "Pizza", votes: null },
        { id: "b", text: "Sushi", votes: null },
      ],
    })

  it("shows only the answers and a hint before voting (X2.3)", async () => {
    feed = [wireQuack("q1", hidden())]
    await renderFeed()

    expect(screen.getByText("Vote to see results")).toBeInTheDocument()
    expect(answer("Pizza")).not.toHaveTextContent(/vote|%/)
  })

  it("marks the choice at once and shows numbers only with the server's answer (X2.5)", async () => {
    feed = [wireQuack("q1", hidden())]
    const user = await renderFeed()

    await user.click(answer("Sushi"))

    expect(answer("Sushi")).toHaveAttribute("aria-pressed", "true")
    expect(answer("Sushi")).not.toHaveTextContent("%")
    expect(screen.getByText("Saving your vote…")).toBeInTheDocument()

    serverAnswers(
      vote(0),
      wirePoll({
        resultsVisibility: "after_vote",
        myVoteOptionId: "b",
        totalVotes: 4,
        options: [
          { id: "a", text: "Pizza", votes: 2 },
          { id: "b", text: "Sushi", votes: 2 },
        ],
      }),
    )

    await waitFor(() => expect(answer("Sushi")).toHaveTextContent("2 votes · 50%"))
    expect(screen.getByText("4 votes")).toBeInTheDocument()
  })

  it("goes back to hidden, without numbers, when the first vote fails (X2.5)", async () => {
    feed = [wireQuack("q1", hidden())]
    const user = await renderFeed()
    await user.click(answer("Sushi"))

    vote(0).reject(new Error("network down"))

    await screen.findByRole("alert")
    expect(answer("Sushi")).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Vote to see results")).toBeInTheDocument()
  })
})

describe("the end (X1)", () => {
  it("shows the time left on an open poll that ends", async () => {
    const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000 + 60 * 1000).toISOString()
    feed = [wireQuack("q1", wirePoll({ endsAt: inThreeHours }))]
    await renderFeed()

    expect(screen.getByText("Ends in 3 hours")).toBeInTheDocument()
  })

  it("shows results and the reader's vote, and nothing to press, once ended", async () => {
    feed = [
      wireQuack(
        "q1",
        wirePoll({ ended: true, endsAt: "2026-10-18T11:00:00.000Z", myVoteOptionId: "a" }),
      ),
    ]
    render(
      <QueryClientProvider client={new QueryClient()}>
        <QuackFeed />
      </QueryClientProvider>,
    )

    expect(await screen.findByText("Ended")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pizza/ })).not.toBeInTheDocument()
    expect(screen.getByText("Your vote")).toBeInTheDocument()
    expect(screen.getByText("3 votes")).toBeInTheDocument()
  })

  it("shows neither for a poll without an end", async () => {
    await renderFeed()

    expect(screen.queryByText(/^Ends in/)).not.toBeInTheDocument()
    expect(screen.queryByText("Ended")).not.toBeInTheDocument()
  })
})
