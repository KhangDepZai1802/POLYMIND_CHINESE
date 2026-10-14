import { expect, test } from "@playwright/test";

test("mobile login: square checkbox and password toggle over LAN", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "This regression exercises touch input.");
  await page.goto(
    `${process.env.E2E_LAN_URL ?? "http://localhost:3000"}/login`,
  );
  const password = page.locator("#password");
  await password.fill("example-password");
  await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).tap();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("example-password");
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).tap();
  await expect(password).toHaveAttribute("type", "password");
  const checkbox = page.locator("#remember");
  const box = await checkbox.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBe(box!.width);
  const label = page.locator('label[for="remember"]');
  expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await label.tap();
  await expect(checkbox).toBeChecked();
  await label.tap();
  await expect(checkbox).not.toBeChecked();
  await expect(page).toHaveURL(/\/login$/);
});
