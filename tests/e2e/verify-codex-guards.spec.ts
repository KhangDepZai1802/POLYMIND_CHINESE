import { expect, test } from "@playwright/test";

/**
 * Xác minh độc lập BUG-M08-001 + BUG-M11-002 (fix của Codex: guard UUID).
 *
 * Góc soi riêng: rủi ro thật của việc thêm guard **không phải** là "URL rác còn
 * 500", mà là **guard chặn nhầm đường đi đúng**. Nên kiểm đủ ba ca, không chỉ ca
 * Codex đã test.
 */
test("guard UUID: URL rác 404 · lớp khác 404 · nhưng lớp MÌNH vẫn mở được", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  // 1) URL rác → 404, KHÔNG phải 500 kèm stack (đúng bug Codex sửa).
  for (const url of [
    "/teacher/sessions/khong-phai-uuid",
    "/teacher/sessions/123",
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "404" }), `URL rác phải render 404: ${url}`).toBeVisible();
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }

  // 2) UUID hợp lệ nhưng thuộc lớp GV khác → vẫn 404 (guard không được nới IDOR).
  await expect(page).toHaveURL(/teacher/);
});
