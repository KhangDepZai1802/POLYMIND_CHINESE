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
  await page.getByLabel("Mật khẩu").fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(`**${path}`);
}

async function expectWcagAA(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function expectTouchTargets(page: Page) {
  const undersized = await page.locator(
    'button:not([disabled]):not([aria-label="Open Next.js Dev Tools"]), input:not([type="hidden"]):not([disabled]), [role="tab"], nav[aria-label^="Điều hướng"] a',
  ).evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || rect.width === 0) return [];
      return rect.width < 44 || rect.height < 44
        ? [{
            element: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }]
        : [];
    }),
  );
  expect(undersized).toEqual([]);
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
      await expect(page.getByRole("navigation", { name: "Điều hướng chính trên di động" })).toBeVisible();
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
