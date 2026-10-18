// Settings are reached from the user menu in the header.
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { HeaderMenu } from "@/features/auth/components/HeaderMenu"

vi.mock("@/features/auth/hooks/useSession", () => ({
  useSession: () => ({
    user: { id: "u1", email: "duck@example.com", name: "Decaf Duck", username: "DecafDuck" },
    isPending: false,
    error: null,
  }),
}))
vi.mock("@/features/auth/hooks/useSignOut", () => ({
  useSignOut: () => ({ mutate: vi.fn(), isPending: false }),
}))

const renderWithRouter = () => {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <HeaderMenu />
        <Outlet />
      </>
    ),
  })
  const home = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null })
  const settings = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: () => <h1>Settings page</h1>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([home, settings]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  render(<RouterProvider router={router} />)
}

describe("HeaderMenu", () => {
  beforeAll(() => {
    // jsdom lacks these; Radix menus call them.
    Element.prototype.hasPointerCapture = () => false
    Element.prototype.setPointerCapture = () => undefined
    Element.prototype.releasePointerCapture = () => undefined
    Element.prototype.scrollIntoView = () => undefined
  })

  it("shows the signed-in user's name and username, and leads to Settings", async () => {
    const user = userEvent.setup()
    renderWithRouter()

    await user.click(await screen.findByRole("button", { name: "User menu" }))

    expect(await screen.findByText("Decaf Duck")).toBeInTheDocument()
    expect(screen.getByText("@DecafDuck")).toBeInTheDocument()
    await user.click(screen.getByRole("menuitem", { name: "Settings" }))
    expect(await screen.findByRole("heading", { name: "Settings page" })).toBeInTheDocument()
  })
})
