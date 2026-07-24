import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

async function loginStudent(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
}

async function expectAccessibleAndContained(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, label).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, label).toEqual([]);
}

test("Hồ sơ có ba khu vực rõ ràng và responsive ba màn", async ({ page }) => {
  await loginStudent(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/student/profile", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Hồ sơ", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Thông tin học viên/, level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Thông tin liên hệ/, level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Đổi mật khẩu/, level: 2 }),
    ).toBeVisible();

    // Yêu cầu độ dài mật khẩu phải nói ra, không để trình duyệt chặn rồi mới biết.
    await expect(page.getByText("Tối thiểu 8 ký tự.")).toBeVisible();

    await expectAccessibleAndContained(page, `profile-${viewport.name}`);

    if (process.env.UIUX_CAPTURE === "1") {
      await page.screenshot({
        path: `C:/tmp/polymind-m27-profile-${viewport.name}.png`,
        fullPage: true,
      });
    }
  }
});

test("Lỗi form được đọc lên và ô nhập trỏ đúng vào lỗi", async ({ page }) => {
  await loginStudent(page);
  await page.setViewportSize(viewports[2]);
  await page.goto("/student/profile", { waitUntil: "domcontentloaded" });

  const fullName = page.getByLabel("Họ và tên");
  await expect(fullName).not.toHaveAttribute("aria-invalid", "true");

  // `contactSchema` chặn tên < 2 ký tự ở server → không có thao tác ghi nào
  // xảy ra, dữ liệu seed không bị đổi.
  await fullName.fill("A");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();

  const error = page.getByRole("alert").filter({ hasText: "Họ tên" });
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute("id", "full_name-error");
  await expect(fullName).toHaveAttribute("aria-invalid", "true");
  await expect(fullName).toHaveAttribute("aria-describedby", "full_name-error");

  // Trang vẫn phải sạch axe khi đang ở trạng thái lỗi.
  await expectAccessibleAndContained(page, "profile-error-state");
});

test("Bàn phím đi được hết ba khu vực và thấy focus", async ({ page }) => {
  await loginStudent(page);
  await page.setViewportSize(viewports[2]);
  await page.goto("/student/profile", { waitUntil: "domcontentloaded" });

  // Đợi form hydrate xong rồi mới đặt focus: gọi `.focus()` ngay sau
  // `domcontentloaded` thì React hydrate xong sẽ lấy mất focus vừa đặt.
  await expect(
    page.getByRole("button", { name: "Lưu thay đổi" }),
  ).toBeEnabled();
  await page.getByLabel("Họ và tên").click();
  await expect(page.getByLabel("Họ và tên")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Số điện thoại")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeFocused();

  await page.keyboard.press("Tab");
  // "Mật khẩu mới" là tiền tố của "Nhập lại mật khẩu mới" nên phải khớp chính xác.
  await expect(page.getByLabel("Mật khẩu mới", { exact: true })).toBeFocused();
});
