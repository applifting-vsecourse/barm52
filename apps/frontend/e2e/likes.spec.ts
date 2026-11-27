import { expect, test, type Locator, type Page } from "@playwright/test"

import { API } from "./env"
import { signUpNewUser } from "./signIn"

const likeButton = (item: Locator) =>
  item.getByRole("button", { name: "Like", exact: true }).first()
const itemWithText = (page: Page, text: string) =>
  page
    .getByRole("article")
    .filter({ has: page.getByText(text, { exact: true }) })
    .last()

async function postQuack(page: Page, text: string) {
  const posted = await page.request.post(`${API}/quacks`, { data: { text } })
  expect(posted.status()).toBe(201)
  return (await posted.json()).id as string
}

async function postReply(page: Page, quackId: string, text: string) {
  const replied = await page.request.post(`${API}/quacks/${quackId}/replies`, { data: { text } })
  expect(replied.status()).toBe(201)
  return (await replied.json()).id as string
}

test("E1: like your own quack, reload, then unlike it", async ({ page }) => {
  await signUpNewUser(page)
  const text = `Likeable quack ${Date.now()}`
  await postQuack(page, text)
  await page.goto("/quacks")
  const button = likeButton(itemWithText(page, text))

  await expect(button).toHaveText("0 likes")
  await expect(button).toHaveAttribute("aria-pressed", "false")
  await button.click()
  await expect(button).toHaveText("1 like")
  await expect(button).toHaveAttribute("aria-pressed", "true")

  await page.reload()
  await expect(button).toHaveText("1 like")
  await expect(button).toHaveAttribute("aria-pressed", "true")
  await button.click()
  await expect(button).toHaveText("0 likes")
  await expect(button).toHaveAttribute("aria-pressed", "false")
})

test("E2: liking a reply changes its count and survives reopening the thread", async ({ page }) => {
  await signUpNewUser(page)
  const stamp = Date.now()
  const text = `Parent ${stamp}`
  const replyText = `Likeable reply ${stamp}`
  const quackId = await postQuack(page, text)
  await postReply(page, quackId, replyText)
  await page.goto("/quacks")
  const parent = itemWithText(page, text)
  const toggle = parent.getByRole("button", { name: "1 reply", exact: true })
  await toggle.click()
  const replyLike = likeButton(itemWithText(page, replyText))
  await expect(replyLike).toHaveText("0 likes")
  await replyLike.click()
  await expect(replyLike).toHaveText("1 like")

  await page.reload()
  await toggle.click()
  await expect(replyLike).toHaveText("1 like")
  await expect(replyLike).toHaveAttribute("aria-pressed", "true")
  await expect(likeButton(parent)).toHaveText("0 likes")
  await expect(likeButton(parent)).toHaveAttribute("aria-pressed", "false")
})

test("E3: a deleted placeholder has no like button and keeps the reply’s like", async ({
  page,
}) => {
  await signUpNewUser(page)
  const stamp = Date.now()
  const quackId = await postQuack(page, `Deleted parent ${stamp}`)
  const replyText = `Reply that stays ${stamp}`
  const replyId = await postReply(page, quackId, replyText)
  const liked = await page.request.put(`${API}/quacks/${replyId}/like`)
  expect(liked.status()).toBe(200)
  expect((await page.request.delete(`${API}/quacks/${quackId}`)).status()).toBe(204)

  await page.goto("/quacks")
  const placeholders = page.getByRole("article").filter({ hasText: "This quack was deleted." })
  const threads = placeholders.getByRole("button", { name: "1 reply", exact: true })
  await expect(threads.first()).toBeVisible()
  await expect(placeholders.getByRole("button", { name: "Like", exact: true })).toHaveCount(0)
  for (const thread of await threads.all()) await thread.click()

  const placeholder = placeholders.filter({ has: page.getByText(replyText, { exact: true }) })
  const replyLike = likeButton(itemWithText(page, replyText))
  await expect(replyLike).toHaveText("1 like")
  await expect(replyLike).toHaveAttribute("aria-pressed", "true")
  await expect(placeholder.getByRole("button", { name: "Like", exact: true })).toHaveCount(1)
})
