// New answers from others (X3) as each reader sees them: the author decides,
// a suggester sees their own suggestion waiting, everyone else sees neither.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import type { Poll } from "@/features/quack/api/quackSchemas"
import { PollView } from "@/features/quack/components/PollView"

vi.mock("@/lib/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const aPoll = (overrides: Partial<Poll> = {}): Poll => ({
  endsAt: null,
  ended: false,
  resultsVisibility: "immediately",
  suggestions: "author_approves",
  isAuthor: false,
  resultsVisible: true,
  totalVotes: 1,
  myVoteOptionId: null,
  canSuggest: true,
  options: [
    { id: "a", text: "Pizza", votes: 1 },
    { id: "b", text: "Sushi", votes: 0 },
  ],
  pendingSuggestions: [],
  ...overrides,
})

const renderPoll = (poll: Poll) => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PollView
        quackId="q1"
        poll={poll}
      />
    </QueryClientProvider>,
  )
  return user
}

const answered = (poll: Poll) => ({ json: () => Promise.resolve(poll) }) as never

describe("suggesting an answer", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.delete).mockReset()
  })

  it("offers a labelled field and the button while the poll takes suggestions (X3.2)", () => {
    renderPoll(aPoll())

    expect(screen.getByLabelText("Your answer")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Suggest an answer" })).toBeInTheDocument()
  })

  it("offers nothing when the poll takes no suggestions (X3.2)", () => {
    renderPoll(aPoll({ suggestions: "not_allowed", canSuggest: false }))

    expect(screen.queryByRole("button", { name: "Suggest an answer" })).not.toBeInTheDocument()
  })

  it("sends the trimmed answer", async () => {
    vi.mocked(api.post).mockReturnValue(answered(aPoll()))
    const user = renderPoll(aPoll())

    await user.type(screen.getByLabelText("Your answer"), "  Tacos ")
    await user.click(screen.getByRole("button", { name: "Suggest an answer" }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("quacks/q1/poll/options", {
        json: { text: "Tacos" },
      }),
    )
  })

  it.each([
    ["", "Write an answer first"],
    [" pizza ", "Answers must be different"],
  ])("refuses %j under the field before asking the server (X3.3)", async (text, message) => {
    const user = renderPoll(aPoll())

    if (text) await user.type(screen.getByLabelText("Your answer"), text)
    await user.click(screen.getByRole("button", { name: "Suggest an answer" }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText("Your answer")).toHaveAttribute("aria-invalid", "true")
    expect(api.post).not.toHaveBeenCalled()
  })

  it("shows the server's refusal under the field (X3.3)", async () => {
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.reject(new Error("This poll already has the maximum number of options")),
    } as never)
    const user = renderPoll(aPoll())

    await user.type(screen.getByLabelText("Your answer"), "Tacos")
    await user.click(screen.getByRole("button", { name: "Suggest an answer" }))

    expect(
      await screen.findByText("This poll already has the maximum number of options"),
    ).toBeInTheDocument()
  })
})

describe("pending suggestions", () => {
  const pending = { pendingSuggestions: [{ id: "s1", text: "Tacos" }] }

  it("lets the author approve or reject each one (X3.6, X3.7)", async () => {
    vi.mocked(api.post).mockReturnValue(answered(aPoll({ isAuthor: true })))
    const user = renderPoll(aPoll({ isAuthor: true, ...pending }))

    expect(screen.getByText("1 suggestion awaiting approval")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Approve" }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("quacks/q1/poll/options/s1/approve"))
  })

  it("rejects one by deleting it", async () => {
    vi.mocked(api.delete).mockReturnValue(answered(aPoll({ isAuthor: true })))
    const user = renderPoll(aPoll({ isAuthor: true, ...pending }))

    await user.click(screen.getByRole("button", { name: "Reject" }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("quacks/q1/poll/options/s1"))
  })

  it("shows a suggester their own one waiting, with nothing to vote or count (X3.6)", () => {
    renderPoll(aPoll(pending))

    expect(screen.getByText("Tacos")).toBeInTheDocument()
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Tacos/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
  })
})
