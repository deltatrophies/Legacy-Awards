import { expect, test } from "@playwright/test";

test("public catalogue flow loads without console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("navigation")).toBeVisible();

  await page.goto("/products");
  await expect(page.getByRole("heading", { name: /Awards for every achievement/i })).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();

  await page.goto("/custom");
  await expect(page.getByRole("heading", { name: /Custom Trophy Studio/i })).toBeVisible();

  await expect(errors).toEqual([]);
});

test("account and admin entry points are reachable", async ({ page }) => {
  await page.goto("/account/orders");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /Create an Account|Welcome Back/i })).toBeVisible();

  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: /Admin Login/i })).toBeVisible();
});
