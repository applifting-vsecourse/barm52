// Attaching a poll to a new quack (story section A): what the form shows, what
// it refuses before the request, and what it sends.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { addQuack } from "@/features/quack/api/addQuack"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackForm } from "@/features/quack/components/QuackForm"

vi.mock("@/features/quack/api/addQuack", () => ({ addQuack: vi.fn() }))

const created: Quack = {
  id: "q1",
  text: "Lunch?",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  poll: null,
}

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

const optionInputs = () => screen.queryAllByLabelText(/^Option \d+$/)

const addPoll = async (user: ReturnType<typeof userEvent.setup>, ...answers: string[]) => {
  await user.type(screen.getByLabelText("New quack"), "Lunch?")
  await user.click(screen.getByRole("button", { name: "Add poll" }))
  for (let i = 2; i < answers.length; i++) {
    await user.click(screen.getByRole("button", { name: "Add option" }))
  }
  for (const [i, answer] of answers.entries()) {
    if (answer) await user.type(optionInputs()[i]!, answer)
  }
}

// Typing into several fields and opening selects adds up; give the slower
// tests room on a busy machine rather than letting them flake.
describe("QuackForm with a poll", { timeout: 20_000 }, () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.setPointerCapture = () => undefined
    Element.prototype.releasePointerCapture = () => undefined
    Element.prototype.scrollIntoView = () => undefined
  })

  beforeEach(() => {
    vi.mocked(addQuack).mockReset()
    vi.mocked(addQuack).mockResolvedValue(created)
  })

  it('"Add poll" opens two empty answers and turns into "Remove poll" (A1)', async () => {
    const user = renderForm()

    await user.click(screen.getByRole("button", { name: "Add poll" }))

    expect(optionInputs()).toHaveLength(2)
    expect(optionInputs().map((input) => (input as HTMLInputElement).value)).toEqual(["", ""])
    expect(screen.getByRole("button", { name: "Add option" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Remove poll" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove option" })).not.toBeInTheDocument()
  })

  it("labels every setting and starts from the defaults for new polls (X1.1, X2.1, X3.1)", async () => {
    const user = renderForm()

    await user.click(screen.getByRole("button", { name: "Add poll" }))

    expect(screen.getByRole("combobox", { name: "Poll length" })).toHaveTextContent("1 day")
    expect(screen.getByRole("combobox", { name: "Results" })).toHaveTextContent(
      "Show results immediately",
    )
    expect(screen.getByRole("combobox", { name: "New answers from others" })).toHaveTextContent(
      "Not allowed",
    )
  })

  it('"Remove poll" drops the poll and its answers, and the quack goes without it (A1)', async () => {
    const user = renderForm()
    await addPoll(user, "Pizza", "Sushi")

    await user.click(screen.getByRole("button", { name: "Remove poll" }))
    expect(optionInputs()).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(addQuack).toHaveBeenCalledOnce())
    expect(posted()).toEqual({ text: "Lunch?" })
  })

  it("adds answers up to ten, and only those past two can be removed (A2)", async () => {
    const user = renderForm()
    await user.click(screen.getByRole("button", { name: "Add poll" }))

    for (let i = 0; i < 8; i++) {
      await user.click(screen.getByRole("button", { name: "Add option" }))
    }

    expect(optionInputs()).toHaveLength(10)
    expect(screen.getByRole("button", { name: "Add option" })).toBeDisabled()
    expect(screen.getAllByRole("button", { name: "Remove option" })).toHaveLength(8)

    await user.click(screen.getAllByRole("button", { name: "Remove option" })[0]!)
    expect(optionInputs()).toHaveLength(9)
    expect(screen.getByRole("button", { name: "Add option" })).toBeEnabled()
  })

  it("posts the answers in order, trimmed, with the settings (A3)", async () => {
    const user = renderForm()
    await addPoll(user, " Pizza ", "Sushi", "Tacos")
    await user.click(screen.getByRole("combobox", { name: "Poll length" }))
    await user.click(await screen.findByRole("option", { name: "7 days" }))
    await user.click(screen.getByRole("combobox", { name: "Results" }))
    await user.click(await screen.findByRole("option", { name: "Show results after voting" }))
    await user.click(screen.getByRole("combobox", { name: "New answers from others" }))
    await user.click(await screen.findByRole("option", { name: "Author approves first" }))

    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(addQuack).toHaveBeenCalledOnce())
    expect(posted()).toEqual({
      text: "Lunch?",
      poll: {
        options: ["Pizza", "Sushi", "Tacos"],
        length: "7d",
        results: "after_vote",
        suggestions: "author_approves",
      },
    })
  })

  it("refuses an empty answer under its field instead of dropping it (A4)", async () => {
    const user = renderForm()
    await addPoll(user, "Pizza", "")

    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Fill in or remove this option")).toBeInTheDocument()
    expect(optionInputs()[1]).toHaveAttribute("aria-invalid", "true")
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("refuses two answers that differ only in case and spaces (A4)", async () => {
    const user = renderForm()
    await addPoll(user, "Pizza", " pizza")

    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByText("Answers must be different")).toBeInTheDocument()
    expect(optionInputs()[1]).toHaveAttribute("aria-invalid", "true")
    expect(addQuack).not.toHaveBeenCalled()
  })

  it("caps an answer at 80 characters", async () => {
    const user = renderForm()
    await user.click(screen.getByRole("button", { name: "Add poll" }))

    expect(optionInputs()[0]).toHaveAttribute("maxLength", "80")
  })

  it("keeps everything typed when the server turns it down (A5)", async () => {
    vi.mocked(addQuack).mockRejectedValue(new Error("Answers must be different"))
    const user = renderForm()
    await addPoll(user, "Pizza", "Sushi")

    await user.click(screen.getByRole("button", { name: "Quack" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Answers must be different")
    expect(optionInputs().map((input) => (input as HTMLInputElement).value)).toEqual([
      "Pizza",
      "Sushi",
    ])
  })

  it("empties the poll part too once posted (A6)", async () => {
    const onPosted = vi.fn()
    const user = renderForm({ onPosted })
    await addPoll(user, "Pizza", "Sushi")

    await user.click(screen.getByRole("button", { name: "Quack" }))

    await waitFor(() => expect(onPosted).toHaveBeenCalledOnce())
    expect(optionInputs()).toHaveLength(0)
    expect(screen.getByRole("button", { name: "Add poll" })).toBeInTheDocument()
  })
})
