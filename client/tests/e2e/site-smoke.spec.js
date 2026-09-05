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
  await expect(page.locator(".catalog-card").first()).toBeVisible();

  await page.goto("/custom");
  await expect(page.getByRole("heading", { name: /Custom Trophy Studio/i })).toBeVisible();

  await expect(errors).toEqual([]);
});

test("account and admin entry points are reachable", async ({ page }) => {
  await page.goto("/account/orders");
  await expect(page.getByRole("heading", { name: /Quote & order history/i })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Create an Account|Welcome Back/i })).toBeVisible();

  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: /Admin Login/i })).toBeVisible();

  await page.goto("/sales/login");
  await expect(page.getByRole("heading", { name: /Sales Team Login/i })).toBeVisible();
});

test("catalogue item can reach cart and invalid quote details are blocked", async ({ page }) => {
  await page.goto("/products");
  const firstProduct = page.locator(".catalog-card").first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.getByRole("link", { name: /^View / }).click();

  await expect(page.getByRole("button", { name: /Add to Quote Cart/i })).toBeVisible();
  await page.getByRole("button", { name: /Add to Quote Cart/i }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("button", { name: /Send Quote Request/i })).toBeVisible();

  await page.getByRole("button", { name: /Send Quote Request/i }).click();
  await expect(page.getByText("Please enter your full name.")).toBeVisible();
  await expect(page.getByText("Please enter your phone number.")).toBeVisible();
  await expect(page.getByText("Please enter your email address.")).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeFocused();
});
