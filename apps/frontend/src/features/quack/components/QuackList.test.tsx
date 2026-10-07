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

  describe("when a search finds nothing", () => {
    it("says what was searched for, and offers to clear it", async () => {
      const onClearSearch = vi.fn()
      render(
        <QuackList
          quacks={[]}
          search="xyzzy"
          onClearSearch={onClearSearch}
        />,
      )

      expect(screen.getByText('No quacks match "xyzzy".')).toBeInTheDocument()
      expect(screen.queryByText("No quacks yet. Post the first one.")).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole("button", { name: "Clear search" }))
      expect(onClearSearch).toHaveBeenCalledOnce()
    })

    it("echoes the search exactly as typed", () => {
      render(
        <QuackList
          quacks={[]}
          search={'@Duck  "Coffee"'}
        />,
      )

      // double space and quotes kept; getByText would collapse the spacing
      expect(screen.getByText(/No quacks match/).textContent).toBe(
        'No quacks match "@Duck  "Coffee"".',
      )
    })

    it("keeps the plain empty feed message when no search is active", () => {
      render(<QuackList quacks={[]} />)

      expect(screen.getByText("No quacks yet. Post the first one.")).toBeInTheDocument()
      expect(screen.queryByText(/No quacks match/)).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    })

    it.each([
      ["while the results are loading", { isLoading: true }],
      ["when the request failed", { error: new Error("Server unreachable") }],
    ])("says nothing about the search %s", (_when, props) => {
      render(
        <QuackList
          quacks={[]}
          search="xyzzy"
          {...props}
        />,
      )

      expect(screen.queryByText(/No quacks match/)).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument()
    })

    it("shows the matches instead of the message when there are some", () => {
      render(
        <QuackList
          quacks={[quack()]}
          search="quack"
        />,
      )

      expect(screen.getByText("quack quack")).toBeInTheDocument()
      expect(screen.queryByText(/No quacks match/)).not.toBeInTheDocument()
    })
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
