import { expect, test } from "@playwright/test";

test("route teacher có id không phải UUID trả 404 thay vì 500", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  await page.goto("/teacher/sessions/khong-phai-uuid");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
