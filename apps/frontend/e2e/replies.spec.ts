import { expect, test, type Page } from "@playwright/test"

import { API } from "./env"
import { signIn } from "./signIn"

type WireQuack = { id: string; text: string; deleted: boolean; replyCount: number }

const listQuacks = async (page: Page, q?: string): Promise<WireQuack[]> =>
  (await page.request.get(`${API}/quacks`, { params: q ? { q } : {} })).json() as Promise<
    WireQuack[]
  >

test("reply to a quack and see the reply under it", async ({ browser }) => {
  const stamp = Date.now()
  const text = `Who has the best bread? ${stamp}`
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  expect((await author.request.post(`${API}/quacks`, { data: { text } })).status()).toBe(201)

  const replier = await browser.newPage()
  await signIn(replier, "deepduckthoughts@example.com", "password2")
  await replier.goto("/quacks")
  const quack = replier.getByRole("article").filter({ hasText: text }).first()
  await quack.getByRole("button", { name: "Reply" }).click()
  await quack.getByLabel("Your reply").fill(`The bakery by the pond ${stamp}`)
  await quack.getByRole("button", { name: "Send reply" }).click()

  await expect(quack.getByText(`The bakery by the pond ${stamp}`)).toBeVisible()
  await expect(quack.getByRole("button", { name: "1 reply" })).toBeVisible()
  // The reply lives under its quack, not as a quack of its own in the feed.
  await replier.reload()
  await expect(replier.getByText(text)).toBeVisible()
  await expect(replier.getByText(`The bakery by the pond ${stamp}`)).toHaveCount(0)

  await author.close()
  await replier.close()
})

test("deleting a quack with replies keeps the replies and wipes its content everywhere", async ({
  browser,
}) => {
  const word = `Zanzibar${Date.now()}`
  const text = `Secret plan ${word}`
  const author = await browser.newPage()
  await signIn(author, "caffeinatedduck@example.com", "password1")
  const posted = (await (
    await author.request.post(`${API}/quacks`, { data: { text } })
  ).json()) as WireQuack

  const replier = await browser.newPage()
  await signIn(replier, "deepduckthoughts@example.com", "password2")
  const reply = `Count me in ${Date.now()}`
  const replied = await replier.request.post(`${API}/quacks/${posted.id}/replies`, {
    data: { text: reply },
  })
  expect(replied.status()).toBe(201)

  await author.goto("/quacks")
  const quack = author.getByRole("article").filter({ hasText: text }).first()
  await quack.getByRole("button", { name: "Delete quack" }).first().click()
  const dialog = author.getByRole("alertdialog")
  await dialog.getByRole("button", { name: "Delete" }).click()
  // The dialog first: while it is open the feed is hidden from getByRole.
  await expect(dialog).toHaveCount(0)

  // In the feed: a placeholder, its reply still under it.
  await expect(author.getByText(text)).toHaveCount(0)
  const placeholder = author
    .getByRole("article")
    .filter({ hasText: "This quack was deleted." })
    .filter({ has: author.getByRole("button", { name: "1 reply" }) })
    .first()
  await placeholder.getByRole("button", { name: "1 reply" }).click()
  await expect(placeholder.getByText(reply)).toBeVisible()

  // Through the API: the feed, the replies and the search hold no trace of it.
  const feed = await listQuacks(replier)
  expect(feed.some((q) => q.text.includes(word))).toBe(false)
  const kept = feed.find((q) => q.id === posted.id)!
  expect(kept).toMatchObject({ deleted: true, text: "", replyCount: 1 })
  expect(await listQuacks(replier, word)).toEqual([])
  const replies = (await (
    await replier.request.get(`${API}/quacks/${posted.id}/replies`)
  ).json()) as WireQuack[]
  expect(replies.map((r) => r.text)).toEqual([reply])

  await author.close()
  await replier.close()
})

test("a deleted quack takes no new replies", async ({ page }) => {
  await signIn(page, "caffeinatedduck@example.com", "password1")
  const posted = (await (
    await page.request.post(`${API}/quacks`, { data: { text: `Short-lived ${Date.now()}` } })
  ).json()) as WireQuack
  await page.request.post(`${API}/quacks/${posted.id}/replies`, { data: { text: "first" } })
  expect((await page.request.delete(`${API}/quacks/${posted.id}`)).status()).toBe(204)

  const response = await page.request.post(`${API}/quacks/${posted.id}/replies`, {
    data: { text: "too late" },
  })
  expect(response.status()).toBe(404)
})
