import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackForm } from "@/features/quack/components/QuackForm"

// The network is out of scope: these tests are about what the form sends.
vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))

const created: Quack = {
  id: "q1",
  text: "hello",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
}

// What the form handed to addQuack. TanStack Query may append arguments of its
// own, so only the first one is the form's.
const posted = () => vi.mocked(addQuack).mock.calls[0]?.[0]

const renderForm = (props: { onPosted?: () => void } = {}) => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuackForm {...props} />
    </QueryClientProvider>,
  )
  return user
}

const moodSelect = () => screen.getByRole("combobox", { name: "Mood" })

describe("QuackForm", () => {
  beforeAll(() => {
    // jsdom doesn't implement these, and Radix Select calls them when it opens
    // a list and when an option is picked.
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.setPointerCapture = () => undefined
    Element.prototype.releasePointerCapture = () => undefined
    Element.prototype.scrollIntoView = () => undefined
  })

  beforeEach(() => {
    vi.mocked(addQuack).mockReset()
    vi.mocked(addQuack).mockResolvedValue(created)
  })

  it("starts with no mood, because a mood is optional", () => {
    renderForm()

    expect(moodSelect()).toHaveTextContent("None")
  })

  it("lets the writer pick any of the four moods, or none", async () => {
    const user = renderForm()

    await user.click(moodSelect())

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Happy",
      "Sad",
      "Angry",
      "Silly",
    ])
  })

  it("posts the chosen mood with the text", async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText("New quack"), "Who moved my bread")
    await user.click(moodSelect())
    await user.click(await screen.findByRole("option", { name: "Angry" }))
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(addQuack).toHaveBeenCalledOnce())
    expect(posted()).toEqual({ text: "Who moved my bread", mood: "angry" })
  })

  it("posts no mood at all when none was chosen", async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText("New quack"), "Just a thought")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(addQuack).toHaveBeenCalledOnce())
    // the form's own "none" must not leak into the request
    expect(posted()).toEqual({ text: "Just a thought" })
  })

  it("tells its parent once a quack has been posted", async () => {
    const onPosted = vi.fn()
    const user = renderForm({ onPosted })

    await user.type(screen.getByLabelText("New quack"), "Just a thought")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(onPosted).toHaveBeenCalledOnce())
  })

  it("does not tell its parent about a quack that was not posted", async () => {
    const onPosted = vi.fn()
    const user = renderForm({ onPosted })

    await user.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Write something first")).toBeInTheDocument()

    expect(addQuack).not.toHaveBeenCalled()
    expect(onPosted).not.toHaveBeenCalled()
  })

  it("does not tell its parent when the server turns the quack down", async () => {
    vi.mocked(addQuack).mockRejectedValue(new Error("Server unreachable"))
    const onPosted = vi.fn()
    const user = renderForm({ onPosted })

    await user.type(screen.getByLabelText("New quack"), "Just a thought")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Server unreachable")).toBeInTheDocument()
    expect(onPosted).not.toHaveBeenCalled()
  })

  it("starts the next quack without a mood", async () => {
    const user = renderForm()

    await user.type(screen.getByLabelText("New quack"), "Quack")
    await user.click(moodSelect())
    await user.click(await screen.findByRole("option", { name: "Silly" }))
    expect(moodSelect()).toHaveTextContent("Silly")
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(moodSelect()).toHaveTextContent("None"))
  })
})
