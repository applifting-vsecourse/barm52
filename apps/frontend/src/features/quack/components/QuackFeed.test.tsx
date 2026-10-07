// The feed is where the search box, the post form and the list meet, so this is
// where the story's browser behaviour is checked. The API is faked: what matters
// here is what the feed asks for and what it shows when the answer comes back.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import { QuackFeed } from "@/features/quack/components/QuackFeed"

vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }))

const wire = (overrides: Record<string, unknown> = {}) => ({
  id: "q1",
  text: "Who moved my bread",
  mood: null,
  userId: "u1",
  createdAt: "2026-01-01T12:00:00.000Z",
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

const FEED_QUACK = "Who moved my bread"

// The fake server: the whole feed for no search, and `onSearch` for any search.
const serve = (onSearch: (q: string) => unknown) =>
  vi.mocked(api.get).mockImplementation(((
    _path: string,
    options?: { searchParams?: { q?: string } },
  ) => ({
    json: () => {
      const q = options?.searchParams?.q
      return Promise.resolve(q === undefined ? [wire()] : onSearch(q))
    },
  })) as never)

// The search each GET carried, in order. `undefined` is a plain feed load.
const requests = () =>
  vi
    .mocked(api.get)
    .mock.calls.map(
      ([, options]) => (options as { searchParams?: { q?: string } } | undefined)?.searchParams?.q,
    )

const renderFeed = () => {
  const user = userEvent.setup()
  const view = render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuackFeed />
    </QueryClientProvider>,
  )
  return { user, ...view }
}

const searchBox = () => screen.getByLabelText("Search quacks")

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("QuackFeed search", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(api.post).mockReturnValue({
      json: () => Promise.resolve(wire({ id: "q2", text: "hello" })),
    } as never)
    serve(() => [])
  })

  describe("the box", () => {
    it("sits between the post form and the list, labelled, with an example", async () => {
      renderFeed()
      const article = await screen.findByRole("article")

      expect(searchBox()).toHaveAttribute("placeholder", "A word or a name")
      expect(searchBox()).toHaveAttribute("type", "text")
      const follows = (a: Node, b: Node) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(follows(screen.getByLabelText("New quack"), searchBox())).toBe(true)
      expect(follows(searchBox(), article)).toBe(true)
    })

    it("is there when the feed has no quacks at all", async () => {
      vi.mocked(api.get).mockImplementation((() => ({ json: () => Promise.resolve([]) })) as never)
      renderFeed()

      expect(await screen.findByText("No quacks yet. Post the first one.")).toBeInTheDocument()
      expect(searchBox()).toBeInTheDocument()
    })

    it("is not focused when the page opens, but its label focuses it", async () => {
      const { user } = renderFeed()
      await screen.findByRole("article")

      expect(searchBox()).not.toHaveFocus()
      await user.click(screen.getByText("Search quacks"))
      expect(searchBox()).toHaveFocus()
    })

    it("takes at most 100 characters", () => {
      renderFeed()

      expect(searchBox()).toHaveAttribute("maxlength", "100")
    })

    it("does nothing special on Enter", async () => {
      const { user } = renderFeed()

      await user.type(searchBox(), "bread{Enter}")
      await waitFor(() => expect(requests()).toEqual([undefined, "bread"]))
      await wait(400)

      expect(requests()).toEqual([undefined, "bread"])
    })
  })

  describe("what it asks for", () => {
    it("waits for a pause in the typing before it searches", async () => {
      const { user } = renderFeed()

      await user.type(searchBox(), "bread")
      expect(requests()).toEqual([undefined])

      await waitFor(() => expect(requests()).toEqual([undefined, "bread"]))
    })

    it("sends the text trimmed, spaces inside kept", async () => {
      const { user } = renderFeed()

      await user.type(searchBox(), "  bread   critic  ")

      await waitFor(() => expect(requests()).toEqual([undefined, "bread   critic"]))
    })

    it("sends no search for a box of only spaces", async () => {
      const { user } = renderFeed()

      await user.type(searchBox(), "   ")
      await wait(400)

      expect(requests()).toEqual([undefined])
    })

    it("treats a box of only @ signs as the plain feed, not a search that found nothing", async () => {
      vi.mocked(api.get).mockImplementation((() => ({ json: () => Promise.resolve([]) })) as never)
      const { user } = renderFeed()

      await user.type(searchBox(), "@@ @")
      await waitFor(() => expect(requests()).toEqual([undefined, "@@ @"]))

      expect(await screen.findByText("No quacks yet. Post the first one.")).toBeInTheDocument()
      expect(screen.queryByText(/No quacks match/)).not.toBeInTheDocument()
    })
  })

  describe("when nothing matches", () => {
    it("says what was searched for, and clearing it brings the feed back with focus in the box", async () => {
      const { user } = renderFeed()
      await screen.findByText(FEED_QUACK)

      await user.type(searchBox(), "  @Duck  xyzzy ")
      const message = await screen.findByText(/No quacks match/)
      expect(message.textContent).toBe('No quacks match "@Duck  xyzzy".')
      expect(screen.queryByText(FEED_QUACK)).not.toBeInTheDocument()
      expect(screen.queryByText("No quacks yet. Post the first one.")).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Clear search" }))

      // at once, without waiting for the pause
      expect(searchBox()).toHaveValue("")
      expect(searchBox()).toHaveFocus()
      expect(await screen.findByText(FEED_QUACK)).toBeInTheDocument()
      expect(screen.queryByText(/No quacks match/)).not.toBeInTheDocument()
    })

    it("keeps the post form and the box on screen", async () => {
      const { user } = renderFeed()

      await user.type(searchBox(), "xyzzy")
      await screen.findByText(/No quacks match/)

      expect(screen.getByLabelText("New quack")).toBeInTheDocument()
      expect(searchBox()).toHaveValue("xyzzy")
    })

    it("offers no other way to clear the box", async () => {
      const { user } = renderFeed()
      await screen.findByText(FEED_QUACK)

      // matches exist, so no empty-result button; and the field is a plain text field
      serve(() => [wire()])
      await user.type(searchBox(), "bread")
      await waitFor(() => expect(requests()).toContain("bread"))

      expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument()
      expect(searchBox()).toHaveAttribute("type", "text")
    })
  })

  describe("while a search is loading", () => {
    it("leaves the previous results alone until the new ones arrive", async () => {
      let answer: (quacks: unknown[]) => void = () => undefined
      serve(() => new Promise((resolve) => (answer = resolve)))
      const { user } = renderFeed()
      await screen.findByText(FEED_QUACK)

      await user.type(searchBox(), "xyzzy")
      await waitFor(() => expect(requests()).toContain("xyzzy"))

      expect(screen.getByText(FEED_QUACK)).toBeInTheDocument()
      expect(screen.queryByText(/No quacks match/)).not.toBeInTheDocument()

      answer([])

      expect(await screen.findByText(/No quacks match/)).toBeInTheDocument()
      expect(screen.queryByText(FEED_QUACK)).not.toBeInTheDocument()
    })
  })

  describe("when the search fails", () => {
    it("shows the error alone, keeps the text, and reload tries the same search again", async () => {
      serve(() => Promise.reject(new Error("Server unreachable")))
      const { user } = renderFeed()
      await screen.findByText(FEED_QUACK)

      await user.type(searchBox(), "bread")

      expect(await screen.findByText("Couldn't load quacks")).toBeInTheDocument()
      expect(screen.getByText("Server unreachable")).toBeInTheDocument()
      expect(screen.queryByText(FEED_QUACK)).not.toBeInTheDocument()
      expect(searchBox()).toHaveValue("bread")

      serve(() => [wire({ text: "Bread, found" })])
      await user.click(screen.getByRole("button", { name: /reload/i }))

      expect(await screen.findByText("Bread, found")).toBeInTheDocument()
      expect(requests().slice(-2)).toEqual(["bread", "bread"])
    })
  })

  describe("posting", () => {
    it("ends the search once the quack is posted", async () => {
      const { user } = renderFeed()
      await screen.findByText(FEED_QUACK)
      await user.type(searchBox(), "xyzzy")
      await screen.findByText(/No quacks match/)

      await user.type(screen.getByLabelText("New quack"), "hello")
      await user.click(screen.getByRole("button", { name: "Quack" }))

      await waitFor(() => expect(searchBox()).toHaveValue(""))
      expect(await screen.findByText(FEED_QUACK)).toBeInTheDocument()
    })

    it("leaves the search alone when posting fails", async () => {
      const { user } = renderFeed()
      await screen.findByText(FEED_QUACK)
      await user.type(searchBox(), "xyzzy")
      await screen.findByText(/No quacks match/)

      await user.click(screen.getByRole("button", { name: "Quack" }))

      expect(await screen.findByText("Write something first")).toBeInTheDocument()
      expect(api.post).not.toHaveBeenCalled()
      expect(searchBox()).toHaveValue("xyzzy")
      expect(screen.getByText(/No quacks match/)).toBeInTheDocument()
    })
  })

  it("starts with an empty box every time the page opens", async () => {
    const { user, unmount } = renderFeed()
    await user.type(searchBox(), "bread")
    expect(searchBox()).toHaveValue("bread")
    unmount()

    renderFeed()

    expect(searchBox()).toHaveValue("")
  })
})
