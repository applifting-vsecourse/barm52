// Replies under a quack and the placeholder a deleted quack leaves behind. The
// API is faked; what the server keeps or wipes is tested on the backend and
// end to end.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

vi.mock("@/lib/api-client", async () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  HTTPError: (await import("ky")).HTTPError,
}))

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "Who moved my bread",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-11-10T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
  parentId: null,
  deleted: false,
  replyCount: 0,
  ...overrides,
})

const REPLY = {
  id: "r1",
  text: "The geese did it",
  mood: null,
  userId: "u2",
  createdAt: "2026-11-10T12:05:00.000Z",
  user: { id: "u2", name: "Deep Duck", username: "DeepDuckThoughts" },
  poll: null,
  parentId: "q1",
  deleted: false,
  replyCount: 0,
}

const renderItem = (item: Quack) => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuackItem
        quack={item}
        currentUserId="u1"
        shouldShowReplies
      />
    </QueryClientProvider>,
  )
  return { user }
}

describe("QuackReplies", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.get).mockReturnValue({ json: () => Promise.resolve([REPLY]) } as never)
  })

  it("shows how many replies there are, and loads them only when opened", async () => {
    const { user } = renderItem(quack({ replyCount: 1 }))

    const toggle = screen.getByRole("button", { name: "1 reply" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(api.get).not.toHaveBeenCalled()

    await user.click(toggle)

    expect(await screen.findByText("The geese did it")).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith("quacks/q1/replies")
  })

  it("sends a reply to the quack", async () => {
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.resolve({ ...REPLY, id: "r2", userId: "u1", text: "Agreed" }),
    } as never)
    const { user } = renderItem(quack())

    await user.click(screen.getByRole("button", { name: "Reply" }))
    await user.type(screen.getByLabelText("Your reply"), "Agreed")
    await user.click(screen.getByRole("button", { name: "Send reply" }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("quacks/q1/replies", { json: { text: "Agreed" } }),
    )
  })

  it("says what's wrong with an empty reply and sends nothing", async () => {
    const { user } = renderItem(quack())

    await user.click(screen.getByRole("button", { name: "Reply" }))
    await user.click(screen.getByRole("button", { name: "Send reply" }))

    expect(await screen.findByText("Write something first")).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it("shows a deleted quack as a placeholder, without its text or author, above its replies", async () => {
    const { user } = renderItem(quack({ deleted: true, text: "", replyCount: 1 }))

    expect(screen.getByText("This quack was deleted.")).toBeInTheDocument()
    expect(screen.queryByText("@CaffeinatedDuck")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete quack" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "1 reply" }))

    expect(await screen.findByText("The geese did it")).toBeInTheDocument()
    // A deleted quack keeps its replies but takes no new ones.
    expect(screen.queryByLabelText("Your reply")).not.toBeInTheDocument()
  })
})
