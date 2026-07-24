import { expect, test, type Page } from "@playwright/test";

/**
 * Khoá kích thước hiển thị THẬT của chữ ký thương hiệu trên mọi bề mặt.
 *
 * Lý do có file này: bản trước gọi logo theo một ô VUÔNG (`size={40}`) trong khi
 * file logo nằm ngang tỉ lệ 2,19:1, nên `object-contain` bóp chữ về ~16px cao —
 * ô 40px nhưng mắt chỉ thấy 16px. Test đo `getBoundingClientRect()` của chính
 * thẻ <img> (không phải ô bọc), vì đó mới là thứ người dùng nhìn thấy; nếu ai đó
 * lại đặt logo vào ô vuông thì chiều cao đo được sẽ tụt và test đỏ.
 */

const ASPECT = 640 / 292; // tỉ lệ gốc của /polymind-lockup.png

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
  // `waitForURL` nhả ngay khi URL đổi, lúc đó lớp phủ NavProgress còn che và
  // khung dashboard CHƯA render — đo header ở đây sẽ ra `null`. Phải đợi <main>.
  await expect(page.locator("main")).toBeVisible();
}

/** Đo thẻ <img> logo: cao/rộng thật khi vẽ, và ảnh có tải được hay không. */
async function measureLogo(page: Page, scope = "body") {
  const img = page.locator(`${scope} img[src*="polymind-lockup"]`).first();
  await expect(img).toBeVisible();
  return img.evaluate((el) => {
    const image = el as HTMLImageElement;
    const rect = image.getBoundingClientRect();
    return {
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      // 0 nghĩa là file 404 hoặc hỏng — <img> vẫn "visible" nên phải kiểm riêng.
      naturalWidth: image.naturalWidth,
      alt: image.getAttribute("alt"),
    };
  });
}

function expectAspect(box: { width: number; height: number }) {
  // Sai số 1px cho phép vì bề rộng được làm tròn từ chiều cao.
  expect(Math.abs(box.width - box.height * ASPECT)).toBeLessThanOrEqual(1.5);
}

test("logo hiển thị đúng cỡ và đúng tỉ lệ ở mọi bề mặt", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "mobile";

  // --- Trang đăng nhập: nền gradient TỐI, logo bọc tile trắng ---
  await page.goto("/login");
  const authLogo = await measureLogo(page);
  expect(authLogo.naturalWidth).toBeGreaterThan(0);
  expect(authLogo.height).toBe(52);
  expectAspect(authLogo);
  // Tên thương hiệu nằm ngay dưới dạng chữ đọc được → logo là ảnh trang trí.
  expect(authLogo.alt).toBe("");
  //
  // ⚠️ Trước M28 câu này đòi một `<h1>POLYMIND CHINESE</h1>`. `DS-042` đã hạ nó
  // xuống `<p>`: bản cũ đặt cùng một `<h1>` ở layout cho CẢ BỐN màn auth, nên
  // người dùng trình đọc màn hình điều hướng bằng heading nghe y hệt nhau ở
  // /login, /forgot-password, /reset-password và /accept-invite. Nay `<h1>` là
  // tên màn, còn tên thương hiệu là chữ thường.
  //
  // Điều bài này THẬT SỰ canh không đổi: `alt=""` chỉ hợp lệ khi tên thương
  // hiệu vẫn có mặt dưới dạng chữ đọc được ở đâu đó cạnh logo. Vẫn kiểm đúng
  // điều đó — chỉ bỏ ràng buộc "phải là h1", vốn là chi tiết trình bày.
  await expect(
    page.getByText("POLYMIND CHINESE", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Đăng nhập",
  );

  for (const account of accounts) {
    await login(page, account.email, account.path);

    if (isMobile) {
      // --- Header di động cao 64px ---
      const header = await measureLogo(page, "header");
      expect(header.naturalWidth).toBeGreaterThan(0);
      expect(header.height).toBe(28);
      expectAspect(header);
      expect(header.alt).toBe("POLYMIND");

      // --- Drawer điều hướng ---
      await page.getByRole("button", { name: "Mở menu điều hướng" }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      const drawerLogo = await measureLogo(page, '[role="dialog"]');
      expect(drawerLogo.height).toBe(36);
      expectAspect(drawerLogo);
      // Radix bắt buộc dialog có title; tên gọi lấy từ alt của chính logo.
      await expect(drawer).toHaveAccessibleName(/POLYMIND/);
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
    } else {
      // --- Sidebar desktop (w-64, còn 216px lọt lòng sau px-5) ---
      const sidebar = await measureLogo(page, "aside");
      expect(sidebar.naturalWidth).toBeGreaterThan(0);
      expect(sidebar.height).toBe(36);
      expectAspect(sidebar);
      // Không được tràn khỏi lọt lòng sidebar.
      expect(sidebar.width).toBeLessThanOrEqual(216);
    }

    // Đúng MỘT logo NHÌN THẤY được. Sidebar và header di động cùng nằm trong
    // DOM (ẩn/hiện bằng breakpoint) nên phải đếm cái đang hiển thị, không đếm
    // node. Bản cũ có cả logo (đã chứa chữ POLYMIND) lẫn một thẻ chữ "POLYMIND"
    // rời bên cạnh — trình đọc màn hình nghe thành hai lần.
    await expect(page.locator('img[src*="polymind-lockup"]:visible')).toHaveCount(1);
    await expect(page.getByText("POLYMIND", { exact: true })).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    // Còn session thì `/login` bị middleware đá về dashboard và vòng sau không
    // thấy form đăng nhập nữa.
    await page.context().clearCookies();
  }
});

test("logo không làm tràn ngang ở màn hẹp nhất", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await login(page, "hv1@polymind.test", "/student");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // Logo + hamburger + chuông + menu người dùng phải cùng nằm trong 360px.
  const headerCrowding = await page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return null;
    const hr = header.getBoundingClientRect();
    const kids = Array.from(header.querySelectorAll("img, button"));
    return kids.map((k) => {
      const r = k.getBoundingClientRect();
      return { left: Math.round(r.left - hr.left), right: Math.round(r.right - hr.left) };
    });
  });
  expect(headerCrowding).not.toBeNull();
  for (const box of headerCrowding ?? []) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(360);
  }
});
