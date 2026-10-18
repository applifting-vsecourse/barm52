// The settings form as the user meets it: it starts from what is saved, says
// what's wrong under the field, saves trimmed values, and Discard goes back to
// the last save. The API is faked; what matters is what goes out and comes back.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/lib/api-client"

import type { Settings } from "@/features/settings/api/settingsSchemas"
import { SettingsForm } from "@/features/settings/components/SettingsForm"

vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const SAVED: Settings = {
  username: "CaffeinatedDuck",
  displayName: "Caffeinated Duck",
  bio: "Runs on espresso.",
  defaultMood: null,
}

// What the form sent with its last save.
const sent = () =>
  (vi.mocked(api.put).mock.calls.at(-1)?.[1] as { json: Settings } | undefined)?.json

// The server saves whatever it is sent.
const serverSaves = () =>
  vi.mocked(api.put).mockImplementation(((_path: string, options: { json: Settings }) => ({
    json: () => Promise.resolve(options.json),
  })) as never)

const renderForm = (settings: Settings = SAVED) => {
  const user = userEvent.setup()
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, "invalidateQueries")
  render(
    <QueryClientProvider client={queryClient}>
      <SettingsForm settings={settings} />
    </QueryClientProvider>,
  )
  return { user, queryClient, invalidate }
}

const field = (label: string) => screen.getByLabelText(label)
const save = () => screen.getByRole("button", { name: "Save" })
const discard = () => screen.getByRole("button", { name: "Discard" })

describe("SettingsForm", { timeout: 20_000 }, () => {
  beforeAll(() => {
    // jsdom lacks these; Radix Select calls them.
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.setPointerCapture = () => undefined
    Element.prototype.releasePointerCapture = () => undefined
    Element.prototype.scrollIntoView = () => undefined
  })

  beforeEach(() => {
    vi.mocked(api.put).mockReset()
    serverSaves()
  })

  it("starts from the saved settings, every field labelled", () => {
    renderForm()

    expect(field("Display name")).toHaveValue("Caffeinated Duck")
    expect(field("Username")).toHaveValue("CaffeinatedDuck")
    expect(field("Bio")).toHaveValue("Runs on espresso.")
    expect(screen.getByRole("combobox", { name: "Default mood" })).toHaveTextContent("None")
    expect(screen.getByText("17/160")).toBeInTheDocument()
  })

  it("saves every field trimmed, an empty bio and no mood as null", async () => {
    const { user } = renderForm()

    await user.clear(field("Display name"))
    await user.type(field("Display name"), "  Decaf Duck ")
    await user.clear(field("Username"))
    await user.type(field("Username"), " Decaf.Duck_2 ")
    await user.clear(field("Bio"))
    await user.click(save())

    await waitFor(() => expect(api.put).toHaveBeenCalledOnce())
    expect(vi.mocked(api.put).mock.calls[0]?.[0]).toBe("settings")
    expect(sent()).toEqual({
      displayName: "Decaf Duck",
      username: "Decaf.Duck_2",
      bio: null,
      defaultMood: null,
    })
  })

  it("saves the chosen default mood", async () => {
    const { user } = renderForm()

    await user.click(screen.getByRole("combobox", { name: "Default mood" }))
    await user.click(await screen.findByRole("option", { name: "Happy" }))
    await user.click(save())

    await waitFor(() => expect(sent()?.defaultMood).toBe("happy"))
  })

  it.each([
    ["Username", "ab", "Username must be 3–30 characters"],
    ["Username", "a".repeat(31), "Username must be 3–30 characters"],
    ["Username", "two words", "Use only letters, numbers, underscores and dots"],
    ["Username", "@duck", "Use only letters, numbers, underscores and dots"],
    ["Display name", "   ", "Display name is required"],
    ["Bio", "x".repeat(161), "Keep it under 160 characters"],
  ])(
    "shows what's wrong with %s %j under the field and saves nothing",
    async (label, value, message) => {
      const { user } = renderForm()

      await user.clear(field(label))
      await user.click(field(label))
      await user.paste(value)
      await user.click(save())

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(field(label)).toHaveAttribute("aria-invalid", "true")
      expect(api.put).not.toHaveBeenCalled()
    },
  )

  it("shows a username someone else has under the username field", async () => {
    // What ky throws for a 409: an error carrying the response.
    const conflict = Object.assign(new Error("That username is taken"), {
      response: new Response(
        JSON.stringify({ message: "That username is taken", field: "username" }),
        { status: 409 },
      ),
    })
    vi.mocked(api.put).mockReturnValue({ json: () => Promise.reject(conflict) } as never)
    const { user } = renderForm()

    await user.clear(field("Username"))
    await user.type(field("Username"), "BreadCritic")
    await user.click(save())

    expect(await screen.findByText("That username is taken")).toBeInTheDocument()
    expect(field("Username")).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(field("Username")).toHaveValue("BreadCritic")
  })

  it("shows any other failure in the alert and keeps what was typed", async () => {
    vi.mocked(api.put).mockReturnValue({
      json: () => Promise.reject(new Error("Server unreachable")),
    } as never)
    const { user } = renderForm()

    await user.clear(field("Display name"))
    await user.type(field("Display name"), "Decaf Duck")
    await user.click(save())

    expect(await screen.findByRole("alert")).toHaveTextContent("Server unreachable")
    expect(field("Display name")).toHaveValue("Decaf Duck")
  })

  it("shows the pending state and blocks a second save while saving", async () => {
    vi.mocked(api.put).mockReturnValue({ json: () => new Promise(() => undefined) } as never)
    const { user } = renderForm()

    await user.click(save())

    await waitFor(() => expect(save()).toBeDisabled())
    expect(discard()).toBeDisabled()
  })

  it("refreshes the rest of the app once saved, so new names show at once", async () => {
    const { user, queryClient, invalidate } = renderForm()

    await user.clear(field("Display name"))
    await user.type(field("Display name"), "Decaf Duck")
    await user.click(save())

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith())
    expect(queryClient.getQueryData(["settings"])).toMatchObject({ displayName: "Decaf Duck" })
  })

  it("Discard goes back to the saved settings", async () => {
    const { user } = renderForm()
    expect(discard()).toBeDisabled()

    await user.clear(field("Display name"))
    await user.type(field("Display name"), "Someone else")
    await user.click(discard())

    expect(field("Display name")).toHaveValue("Caffeinated Duck")
    expect(discard()).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it("after a save, Discard goes back to what was just saved", async () => {
    const { user } = renderForm()
    await user.clear(field("Display name"))
    await user.type(field("Display name"), "Decaf Duck")
    await user.click(save())
    await waitFor(() => expect(discard()).toBeDisabled())

    await user.type(field("Display name"), " again")
    await user.click(discard())

    expect(field("Display name")).toHaveValue("Decaf Duck")
  })
})
