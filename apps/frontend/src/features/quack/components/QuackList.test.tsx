// Example component test — the pattern to copy for your own components.
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackList } from "@/features/quack/components/QuackList"

const quack = (overrides: Partial<Quack> = {}): Quack => ({
  id: "q1",
  text: "quack quack",
  mood: null,
  userId: "u1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  user: { id: "u1", name: "Caffeinated Duck", username: "CaffeinatedDuck" },
  ...overrides,
})

describe("QuackList", () => {
  it("renders quacks with author info", () => {
    render(<QuackList quacks={[quack()]} />)

    expect(screen.getByText("quack quack")).toBeInTheDocument()
    expect(screen.getByText("Caffeinated Duck")).toBeInTheDocument()
    expect(screen.getByText("@CaffeinatedDuck")).toBeInTheDocument()
  })

  it.each([
    ["happy", "Happy"],
    ["sad", "Sad"],
    ["angry", "Angry"],
    ["silly", "Silly"],
  ] as const)("shows the %s mood on a quack", (mood, label) => {
    render(<QuackList quacks={[quack({ mood })]} />)

    expect(screen.getByText(label)).toBeInTheDocument()
    // screen readers hear it as a mood, not as a stray word after the date
    expect(screen.getByText("Mood:")).toBeInTheDocument()
  })

  it("shows the mood of every quack in the feed that has one", () => {
    render(
      <QuackList
        quacks={[
          quack({ id: "q1", mood: "angry" }),
          quack({ id: "q2", mood: null }),
          quack({ id: "q3", mood: "silly" }),
        ]}
      />,
    )

    expect(screen.getAllByRole("article")).toHaveLength(3)
    expect(screen.getByText("Angry")).toBeInTheDocument()
    expect(screen.getByText("Silly")).toBeInTheDocument()
    expect(screen.getAllByText("Mood:")).toHaveLength(2)
  })

  it("renders a quack without a mood exactly as before", () => {
    render(<QuackList quacks={[quack({ mood: null })]} />)

    expect(screen.queryByText("Mood:")).not.toBeInTheDocument()
    for (const label of ["Happy", "Sad", "Angry", "Silly"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    // the one separator between author and date, and none added for a mood
    expect(screen.getAllByText("·")).toHaveLength(1)
  })

  it("shows an error with a working reload button", async () => {
    const onReload = vi.fn()
    render(
      <QuackList
        quacks={[]}
        error={new Error("Server unreachable")}
        onReload={onReload}
      />,
    )

    expect(screen.getByText("Couldn't load quacks")).toBeInTheDocument()
    expect(screen.getByText("Server unreachable")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /reload/i }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
