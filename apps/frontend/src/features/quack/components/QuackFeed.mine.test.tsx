// Deleting your own quacks and the All / Mine tabs, in the browser. The API is
// faked; the server's own checks (403 for someone else's quack, 401 signed out)
// are tested on the backend and end to end.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import { QuackFeed } from "@/features/quack/components/QuackFeed"

vi.mock("@/lib/api-client", async () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  HTTPError: (await import("ky")).HTTPError,
}))

const wire = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  text: "Who moved my bread",
  mood: null,
  userId: "u1",
  createdAt: "2026-01-01T12:00:00.000Z",
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

const MINE = wire({ id: "q1", text: "My own quack" })
const THEIRS = wire({
  id: "q2",
  text: "Somebody else's quack",
  userId: "u2",
  user: { id: "u2", name: "Deep Duck", username: "DeepDuckThoughts" },
})

type GetOptions = { searchParams?: Record<string, string> }

// The fake server: every quack, or only u1's when asked for mine.
let stored = [MINE, THEIRS]
const serve = () =>
  vi.mocked(api.get).mockImplementation(((_path: string, options?: GetOptions) => ({
    json: () =>
      Promise.resolve(
        options?.searchParams?.mine === "true"
          ? stored.filter((quack) => quack.userId === "u1")
          : stored,
      ),
  })) as never)

const renderFeed = () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuackFeed currentUserId="u1" />
    </QueryClientProvider>,
  )
  return { user }
}

const article = (text: string) => screen.getByText(text).closest("article")!

describe("QuackFeed delete and Mine", () => {
  beforeEach(() => {
    stored = [MINE, THEIRS]
    vi.mocked(api.get).mockReset()
    vi.mocked(api.delete).mockReset()
    serve()
  })

  describe("deleting", () => {
    it("offers Delete on my quacks only", async () => {
      renderFeed()
      await screen.findByText("Somebody else's quack")

      expect(
        within(article("My own quack")).getByRole("button", { name: "Delete quack" }),
      ).toBeInTheDocument()
      expect(
        within(article("Somebody else's quack")).queryByRole("button", { name: "Delete quack" }),
      ).not.toBeInTheDocument()
    })

    it("asks first, and Cancel deletes nothing", async () => {
      const { user } = renderFeed()
      await screen.findByText("My own quack")

      await user.click(screen.getByRole("button", { name: "Delete quack" }))
      const dialog = screen.getByRole("alertdialog", { name: "Delete this quack?" })
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

      expect(api.delete).not.toHaveBeenCalled()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(screen.getByText("My own quack")).toBeInTheDocument()
    })

    it("deletes on confirm and the quack leaves the feed", async () => {
      vi.mocked(api.delete).mockImplementation((() => {
        stored = [THEIRS]
        return Promise.resolve(new Response(null, { status: 204 }))
      }) as never)
      const { user } = renderFeed()
      await screen.findByText("My own quack")

      await user.click(screen.getByRole("button", { name: "Delete quack" }))
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
      )

      expect(api.delete).toHaveBeenCalledWith("quacks/q1")
      await waitFor(() => expect(screen.queryByText("My own quack")).not.toBeInTheDocument())
      expect(screen.getByText("Somebody else's quack")).toBeInTheDocument()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })

    it("keeps the dialog open with the reason when the server refuses", async () => {
      vi.mocked(api.delete).mockRejectedValue(new Error("You can only delete your own quacks"))
      const { user } = renderFeed()
      await screen.findByText("My own quack")

      await user.click(screen.getByRole("button", { name: "Delete quack" }))
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }),
      )

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "You can only delete your own quacks",
      )
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
      expect(screen.getByText("My own quack")).toBeInTheDocument()
    })
  })

  describe("the tabs", () => {
    it("start on All and show everybody's quacks", async () => {
      renderFeed()

      expect(await screen.findByText("Somebody else's quack")).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true")
    })

    it("Mine asks the server for mine, without naming a user, and shows only mine", async () => {
      const { user } = renderFeed()
      await screen.findByText("Somebody else's quack")

      await user.click(screen.getByRole("tab", { name: "Mine" }))

      await waitFor(() =>
        expect(screen.queryByText("Somebody else's quack")).not.toBeInTheDocument(),
      )
      expect(screen.getByText("My own quack")).toBeInTheDocument()
      const sent = vi.mocked(api.get).mock.calls.map(([, options]) => options as GetOptions)
      expect(sent.at(-1)?.searchParams).toEqual({ mine: "true" })
      expect(JSON.stringify(sent)).not.toContain("u1")
    })

    it("an empty Mine says so and offers to write the first one", async () => {
      stored = [THEIRS]
      const { user } = renderFeed()
      await screen.findByText("Somebody else's quack")

      await user.click(screen.getByRole("tab", { name: "Mine" }))
      await screen.findByText("You haven't posted any quacks yet. Yours will show up here.")
      await user.click(screen.getByRole("button", { name: "Write your first quack" }))

      expect(screen.getByLabelText("New quack")).toHaveFocus()
    })
  })
})
