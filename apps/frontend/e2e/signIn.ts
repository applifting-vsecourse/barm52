import { expect, type Page } from "@playwright/test"

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible()
}

// A brand-new account, so a test can start from "no quacks yet" no matter what
// other tests or the seed have posted. Signing up signs the user in.
export async function signUpNewUser(page: Page) {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  await page.goto("/signup")
  await page.getByLabel("Name", { exact: true }).fill("E2E Duck")
  await page.getByLabel("Username").fill(`e2e${id}`)
  await page.getByLabel("Email").fill(`e2e${id}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("password123")
  await page.getByLabel("Confirm password").fill("password123")
  await page.getByRole("button", { name: "Sign up" }).click()
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible()
}
