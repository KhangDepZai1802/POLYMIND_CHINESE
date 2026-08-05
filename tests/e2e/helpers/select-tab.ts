import { expect, type Page } from "@playwright/test";

/**
 * Chọn một mục của dải tab — đúng ở MỌI bề rộng.
 *
 * Từ `UX-MOBILE-1` (2026-08-05) dải tab ngang bị `display:none` dưới 640px và
 * thay bằng nút chọn + bảng trượt, nên `getByRole("tab").click()` chỉ còn dùng
 * được ở màn rộng — ở màn hẹp nó đỏ với lỗi *element is not visible*, mà đó là
 * hành vi ĐÚNG chứ không phải hỏng.
 *
 * ⚠️ Phải trỏ đúng `[data-slot="tab-picker"]`: trang nào cũng có sẵn một
 * `Sheet` khác (menu điện thoại ở header), nên "cái sheet-trigger đầu tiên"
 * hay mở nhầm menu điều hướng.
 */
export async function selectTab(page: Page, name: string | RegExp) {
  const tab = page.getByRole("tab", { name });

  if (await tab.isVisible()) {
    await tab.click();
    return;
  }

  const picker = page.locator('[data-slot="tab-picker"]:visible').first();
  await expect(picker).toBeVisible();
  await picker.click();

  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name }).click();
  await expect(sheet).toBeHidden();
}

/**
 * Dải tab có đúng `count` mục — hỏi đúng bề mặt đang hiện ở bề rộng hiện tại.
 *
 * Dưới 640px dải ngang là `display:none` nên Playwright **không** thấy
 * `role="tab"` nào (phần tử `display:none` không nằm trong cây trợ năng, và đó
 * là điều mong muốn). Bề mặt lúc đó là nút chọn, và chính con số `n/N` trên nút
 * là thứ nói cho người dùng biết module có bao nhiêu mục.
 */
export async function expectTabCount(page: Page, count: number) {
  const picker = page.locator('[data-slot="tab-picker"]:visible');

  if ((await picker.count()) > 0) {
    await expect(picker.first()).toContainText(`/${count}`);
    return;
  }

  await expect(page.getByRole("tab")).toHaveCount(count);
}
