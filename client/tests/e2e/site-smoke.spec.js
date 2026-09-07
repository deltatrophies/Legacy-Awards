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

test("main screens do not overflow and the mobile navigation stays usable", async ({ page }) => {
  const routes = ["/", "/products", "/custom", "/cart", "/login", "/admin/login", "/sales/login"];
  const viewports = [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText("Loading Legacy Awards");
      const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        contentWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.contentWidth, `${route} overflows at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const mobileMenu = page.locator(".mobile-menu");
  await expect(mobileMenu).toBeVisible();
  await expect(mobileMenu.getByRole("link", { name: "Awards" })).toBeVisible();
  await expect(mobileMenu.getByRole("link", { name: "Custom Studio" })).toBeVisible();
  await expect(mobileMenu.getByRole("link", { name: "Talk to Us" })).toBeVisible();
});

test("sales workspace remains usable at mobile and desktop widths", async ({ page }) => {
  await page.goto("/sales/login");
  await page.getByLabel("Email").fill("sales3@legacyawards.dev");
  await page.getByLabel("Password").fill("SalesThree@123");
  await page.getByRole("button", { name: "Open Sales Workspace" }).click();
  await expect(page).toHaveURL(/\/sales\/dashboard$/);
  await expect(page.getByRole("button", { name: "Unassigned queue" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Claim (lead|order)/i })).toHaveCount(0);

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const section of ["dashboard", "leads", "orders"]) {
      await page.goto(`/sales/${section}`);
      await expect(page.getByRole("heading", { level: 1, name: section === "orders" ? "Paid Orders" : section[0].toUpperCase() + section.slice(1), exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Unassigned queue" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Claim (lead|order)/i })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});
