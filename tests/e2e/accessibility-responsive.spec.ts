import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const accounts = [
  { email: "admin@polymind.test", path: "/admin" },
  { email: "gv.a@polymind.test", path: "/teacher" },
  { email: "hv1@polymind.test", path: "/student" },
] as const;

async function login(page: Page, email: string, path: string) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(`**${path}`);
}

async function expectWcagAA(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

/* Ngưỡng đi theo LOẠI CON TRỎ, đúng như `DS-013` đã chốt:
 *
 *   - Cảm ứng (`pointer: coarse`) → **44×44**. Ngón tay không nhắm chính xác
 *     được; đây là luật `globals.css` đang ép và là chỗ lỗi thật hay xuất hiện.
 *   - Chuột (`pointer: fine`) → **24×24**, tức WCAG 2.5.8 Target Size (Minimum),
 *     mức AA. Bản 44px là 2.5.5 Enhanced — mức **AAA**, và `DS-013` đã cố ý
 *     KHÔNG áp cho chuột: thang 32/36/40/44 tồn tại để tạo phân cấp kích thước
 *     trên desktop. Trước `DS-013` cả 8 size đều 44px nên hàm này đo 44 ở mọi
 *     nơi cũng xanh; sau `DS-013` thì con số 44 cho desktop là luật đã bị thay,
 *     không phải lỗi giao diện.
 *
 * Giữ nguyên tinh thần: vẫn là một ngưỡng có thật của WCAG, chỉ là đúng mức và
 * đúng ngữ cảnh — không phải nới cho test xanh. */
async function expectTouchTargets(page: Page) {
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  const minSize = coarse ? 44 : 24;

  const undersized = await page.locator(
    'button:not([disabled]):not([aria-label="Open Next.js Dev Tools"]), input:not([type="hidden"]):not([disabled]), [role="tab"], nav[aria-label^="Điều hướng"] a',
  ).evaluateAll((elements, limit) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || rect.width === 0) return [];
      return rect.width < limit || rect.height < limit
        ? [{
            element: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }]
        : [];
    }),
  minSize);
  expect(undersized, `ngưỡng ${minSize}px (${coarse ? "cảm ứng" : "chuột"})`).toEqual([]);
}

test("WCAG AA, keyboard, touch target và responsive cho cả 3 role", async ({ page }, testInfo) => {
  await page.goto("/login");
  await expectWcagAA(page);
  await expectTouchTargets(page);

  for (const account of accounts) {
    await login(page, account.email, account.path);
    await expect(page.locator("main")).toBeVisible();
    await expectWcagAA(page);
    await expectTouchTargets(page);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    if (testInfo.project.name === "mobile") {
      // Menu di động nằm trong drawer: nút hamburger luôn hiện, mở ra mới thấy nav.
      const menuButton = page.getByRole("button", { name: "Mở menu điều hướng" });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      await expect(
        page.getByRole("navigation", { name: "Điều hướng chính trên di động" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByRole("navigation", { name: "Điều hướng chính", exact: true })).toBeVisible();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const skipLink = page.getByRole("link", { name: "Bỏ qua điều hướng" });
      // Next dev chèn nút Dev Tools vào tab order; production không có nút này.
      for (let index = 0; index < 3 && !(await skipLink.evaluate((node) => node === document.activeElement)); index += 1) {
        await page.keyboard.press("Tab");
      }
      await expect(skipLink).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
    }

    await page.context().clearCookies();
  }
});
