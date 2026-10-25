import { expect, test, type Page } from "@playwright/test"

import { API } from "./env"
import { signIn, signUpNewUser } from "./signIn"

async function findQuackNotBy(page: Page, username: string): Promise<{ id: string }> {
  const quacks: { id: string; user: { username: string } }[] = await (
    await page.request.get(`${API}/quacks`)
  ).json()
  return quacks.find((quack) => quack.user.username !== username)!
}

test("author can post a quack and delete it", async ({ page }) => {
  const text = `E2E quack ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")

  await page.getByLabel("New quack").fill(text)
  await page.getByRole("button", { name: "Quack", exact: true }).click()
  const quack = page.getByRole("article").filter({ hasText: text })
  await expect(quack).toBeVisible()

  await quack.getByRole("button", { name: "Delete quack" }).click()
  const dialog = page.getByRole("alertdialog", { name: "Delete this quack?" })
  await dialog.getByRole("button", { name: "Delete" }).click()
  await expect(quack).toHaveCount(0)
  await expect(dialog).toHaveCount(0)

  // Gone on the server too, not just hidden in this tab.
  await page.reload()
  await expect(page.getByRole("article").first()).toBeVisible()
  await expect(page.getByRole("article").filter({ hasText: text })).toHaveCount(0)
})

test("cancelling the confirmation keeps the quack", async ({ page }) => {
  const text = `E2E keep ${Date.now()}`
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.request.post(`${API}/quacks`, { data: { text } })
  await page.goto("/quacks")

  const quack = page.getByRole("article").filter({ hasText: text })
  await quack.getByRole("button", { name: "Delete quack" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click()

  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(quack).toBeVisible()
})

test("nobody can delete someone else's quack", async ({ page }) => {
  await signIn(page, "deepduckthoughts@example.com", "password2")
  await page.goto("/quacks")

  const othersQuack = page.getByRole("article").filter({ hasNotText: "@DeepDuckThoughts" }).first()
  await expect(othersQuack).toBeVisible()
  await expect(othersQuack.getByRole("button", { name: "Delete quack" })).toHaveCount(0)

  // The button is hidden. Now skip the UI and ask the server directly.
  const notMine = await findQuackNotBy(page, "DeepDuckThoughts")
  const response = await page.request.delete(`${API}/quacks/${notMine.id}`)
  expect(response.status()).toBe(403)
})

test("signed out, the API refuses to delete with 401", async ({ page, request }) => {
  await signIn(page, "deepduckthoughts@example.com", "password2")
  const someQuack = await findQuackNotBy(page, "DeepDuckThoughts")

  // `request` has no session cookie: it is a visitor who never signed in.
  const response = await request.delete(`${API}/quacks/${someQuack.id}`)
  expect(response.status()).toBe(401)
})

test("Mine shows only my quacks", async ({ page }) => {
  await signIn(page, "caffeinatedduck@example.com", "password1")
  await page.goto("/quacks")
  await expect(
    page.getByRole("article").filter({ hasNotText: "@CaffeinatedDuck" }).first(),
  ).toBeVisible()

  await page.getByRole("tab", { name: "Mine" }).click()

  await expect(page.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("article").first()).toBeVisible()
  await expect(page.getByRole("article").filter({ hasNotText: "@CaffeinatedDuck" })).toHaveCount(0)
  // Every quack in Mine can be deleted by me, and the URL names no user.
  const articles = page.getByRole("article")
  await expect(articles.getByRole("button", { name: "Delete quack" })).toHaveCount(
    await articles.count(),
  )
  expect(page.url()).not.toMatch(/user/i)
})

test("an empty Mine says so and offers to write the first quack", async ({ page }) => {
  await signUpNewUser(page)
  await page.goto("/quacks")

  await page.getByRole("tab", { name: "Mine" }).click()

  await expect(page.getByText("You haven't posted any quacks yet.")).toBeVisible()
  await page.getByRole("button", { name: "Write your first quack" }).click()
  await expect(page.getByLabel("New quack")).toBeFocused()
})
