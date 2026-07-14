import { expect, test } from "@playwright/test";

test("route teacher có id không phải UUID trả 404 thay vì 500", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  const assignment = await page.goto("/teacher/assignments/khong-phai-uuid");
  expect(assignment?.status()).toBe(404);

  const session = await page.goto("/teacher/sessions/khong-phai-uuid");
  expect(session?.status()).toBe(404);
});
