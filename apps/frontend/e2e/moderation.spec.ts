import { expect, test, type Page } from "@playwright/test"

import { API } from "./env"
import { signIn } from "./signIn"

type WireQuack = { id: string; text: string; user: { username: string } }

const listQuacks = async (page: Page): Promise<WireQuack[]> =>
  (await page.request.get(`${API}/quacks`)).json() as Promise<WireQuack[]>

test("admin can delete someone else's quack", async ({ browser }) => {
  // The author posts the quack the test deletes, so the seed isn't eaten up.
  const text = `Spam ${Date.now()}`
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const posted = await author.request.post(`${API}/quacks`, { data: { text } })
  expect(posted.status()).toBe(201)

  const admin = await browser.newPage()
  await signIn(admin, "admin@example.com", "adminpassword")
  await admin.goto("/quacks")
  const quack = admin.getByRole("article").filter({ hasText: text })
  await expect(quack).toContainText("@CaffeinatedDuck")

  await quack.getByRole("button", { name: "Delete quack" }).click()
  const dialog = admin.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Delete" }).click()
  // The dialog first: while it is open the feed behind it is hidden from the
  // accessibility tree, so the quack would look gone even when it isn't.
  await expect(dialog).toHaveCount(0)
  await expect(quack).toHaveCount(0)

  // Gone on the server, for the author too.
  expect((await listQuacks(author)).some((q) => q.text === text)).toBe(false)

  await author.close()
  await admin.close()
})

test("admin sees Delete on every quack", async ({ page }) => {
  await signIn(page, "admin@example.com", "adminpassword")
  await page.goto("/quacks")

  const articles = page.getByRole("article")
  await expect(articles.filter({ hasNotText: "@superadmin" }).first()).toBeVisible()
  await expect(articles.getByRole("button", { name: "Delete quack" })).toHaveCount(
    await articles.count(),
  )
})

test("a name with Admin in it is not the admin role: 403", async ({ page }) => {
  // "Pond Admin" from the seed is a regular user. Only the role counts.
  await signIn(page, "pondadmin@example.com", "password5")
  const notMine = (await listQuacks(page)).find((q) => q.user.username !== "PondAdmin")!

  const response = await page.request.delete(`${API}/quacks/${notMine.id}`)
  expect(response.status()).toBe(403)
})
