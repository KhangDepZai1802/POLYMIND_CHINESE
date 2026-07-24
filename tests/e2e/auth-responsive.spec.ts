import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * UIUX-M28 — Xác thực & trang gốc.
 *
 * Mỗi bài dưới đây khoá lại MỘT lỗi đã đo được trước khi sửa, không phải soát
 * lấy lệ. Số đo baseline ghi ngay tại chỗ để phiên sau đọc là biết bài này canh
 * cái gì và vì sao.
 *
 * Trang gốc `/` **không có bài nào**: nó chỉ `redirect("/login")`, 11 dòng,
 * không render giao diện nào cả — xem `RootPage`. Ghi ra đây để phiên sau không
 * tưởng là bỏ sót.
 */

const WIDTHS = [360, 390, 430, 768, 1024, 1280] as const;

const SCREENS = [
  { path: "/login", heading: "Đăng nhập" },
  { path: "/forgot-password", heading: "Quên mật khẩu" },
  { path: "/reset-password", heading: "Đặt lại mật khẩu" },
  { path: "/accept-invite", heading: "Kích hoạt tài khoản" },
] as const;

async function open(page: Page, path: string) {
  await page.goto(path);
  // `DS-038`: chờ mạng lặng rồi mới đếm heading/landmark. Đếm khi RSC còn
  // stream đã hai lần suýt tạo báo động giả ở `P17-T5`.
  await page.waitForLoadState("networkidle");
}

test.describe("UIUX-M28 — cấu trúc trang xác thực", () => {
  for (const screen of SCREENS) {
    test(`${screen.path} — đúng một <main> và <h1> gọi đúng tên màn`, async ({
      page,
    }) => {
      await open(page, screen.path);

      // Baseline trước khi sửa: `main` = 0 ở CẢ BỐN màn, và thẻ <form> nằm
      // ngoài mọi landmark. Khu đã đăng nhập có <main> từ lâu, auth bị bỏ sót.
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("main form")).toHaveCount(1);

      // Baseline: cả 4 màn có ĐÚNG MỘT heading và cả 4 mang cùng một chữ
      // "POLYMIND CHINESE" — người dùng trình đọc màn hình điều hướng bằng
      // heading không thể biết mình đang ở màn nào. Tên màn thật là <div> vì
      // `CardTitle` mặc định là <div>.
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText(screen.heading);
      await expect(
        page.getByRole("heading", { name: "POLYMIND CHINESE" }),
      ).toHaveCount(0);
    });

    test(`${screen.path} — axe sạch ở 360 và 1280`, async ({ page }) => {
      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await open(page, screen.path);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(results.violations, `axe @${width}px ${screen.path}`).toEqual(
          [],
        );
      }
    });

    test(`${screen.path} — không tràn ngang ở 6 bề rộng`, async ({ page }) => {
      await open(page, screen.path);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        // Chờ bố trí xong rồi mới đo: đọc `scrollWidth` trước khi trình duyệt
        // bố trí lại từng cho ra 0 ngẫu nhiên (bài học phiên 58).
        await expect(page.locator("main form")).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `tràn ngang @${width}px ${screen.path}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("UIUX-M28 — trạng thái lỗi đăng nhập", () => {
  test("tiêu điểm về khối lỗi, giữ tên đăng nhập, ô nhập báo lỗi", async ({
    page,
  }) => {
    await open(page, "/login");

    await page.getByLabel("Tên đăng nhập").fill("khong.ton.tai");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("saibet123");
    await page.getByLabel("Mật khẩu", { exact: true }).focus();
    expect(
      await page.evaluate(() => document.activeElement?.id),
      "tiền đề: đang đứng ở ô mật khẩu trước khi bấm",
    ).toBe("password");

    await page.getByRole("button", { name: "Đăng nhập" }).click();

    // ⚠️ KHÔNG dùng `getByRole("alert")`: Next.js tự chèn
    // `#__next-route-announcer__` cũng mang `role="alert"`, nên locator đó khớp
    // 2 phần tử và hỏng ở strict mode. Bám theo `data-slot` của chính component.
    const alert = page.locator("[data-slot=alert]");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/Tên đăng nhập hoặc mật khẩu không đúng/);

    // Baseline: tiêu điểm rơi về `BODY` (nút gửi bị `disabled` trong lúc chờ,
    // trình duyệt không giữ tiêu điểm trên phần tử vừa disabled) → người dùng
    // bàn phím phải bấm 5 lần Tab mới quay lại được ô mật khẩu.
    await expect(alert).toBeFocused();

    // Baseline: React 19 gọi `form.reset()` sau mỗi form action → gõ sai mật
    // khẩu một lần là mất luôn tên đăng nhập. Đã kiểm chứng ngược bằng
    // `git stash`: code gốc cũng mất, tức lỗi có sẵn chứ không phải hồi quy.
    await expect(page.getByLabel("Tên đăng nhập")).toHaveValue("khong.ton.tai");

    // Câu lỗi nói về CẢ HAI ô nên đánh dấu cả hai mới đúng sự thật.
    await expect(page.getByLabel("Tên đăng nhập")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByLabel("Mật khẩu", { exact: true }),
    ).toHaveAttribute("aria-invalid", "true");

    // Từ khối lỗi, Tab tiếp theo phải đi vào form chứ không nhảy lung tung.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe(
      "identifier",
    );

    // Còn lỗi thì trang vẫn phải sạch axe — trạng thái lỗi cũng là một màn hình.
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, "axe ở trạng thái lỗi").toEqual([]);
  });
});

test.describe("UIUX-M28 — ô mật khẩu", () => {
  test("nút hiện/ẩn: đổi kiểu ô, KHÔNG gửi form, tên gọi riêng từng ô", async ({
    page,
  }) => {
    await open(page, "/reset-password");

    const pw = page.getByLabel("Mật khẩu mới", { exact: true });
    await pw.fill("matkhaudai123");
    await expect(pw).toHaveAttribute("type", "password");

    // Hai ô mật khẩu trên cùng một màn → hai nút icon. Nếu cả hai cùng tên
    // "Hiện mật khẩu" thì trùng tên gọi được — đúng lỗi đã sửa ở M18. Kiểu dữ
    // liệu của `PasswordInput` bắt buộc `fieldLabel` để chặn lỗi đó quay lại.
    const showNew = page.getByRole("button", { name: "Hiện mật khẩu mới" });
    const showConfirm = page.getByRole("button", {
      name: "Hiện ô nhập lại mật khẩu",
    });
    await expect(showNew).toHaveCount(1);
    await expect(showConfirm).toHaveCount(1);

    await showNew.click();
    await expect(pw).toHaveAttribute("type", "text");
    // Giá trị không được đổi khi chỉ hiện/ẩn.
    await expect(pw).toHaveValue("matkhaudai123");
    // `type="button"`: thiếu nó thì nút trong <form> mặc định là submit, bấm để
    // xem mật khẩu lại thành gửi form đi.
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Đặt lại mật khẩu",
    );

    await expect(
      page.getByRole("button", { name: "Ẩn mật khẩu mới" }),
    ).toHaveCount(1);
  });

  test("yêu cầu độ dài được chính ô mật khẩu trỏ tới", async ({ page }) => {
    await open(page, "/reset-password");

    // Baseline: dòng "Ít nhất 8 ký tự." là `text-xs` (12px) và KHÔNG được ô nào
    // `aria-describedby` trỏ tới — trình đọc màn hình đọc tới ô mật khẩu là
    // không nghe thấy yêu cầu. `/student/profile` đã làm đúng từ M27.
    const pw = page.getByLabel("Mật khẩu mới", { exact: true });
    const describedBy = await pw.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const hint = page.locator(`#${describedBy!.split(" ")[0]}`);
    await expect(hint).toHaveText("Ít nhất 8 ký tự.");
    const fontSize = await hint.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize),
    );
    expect(fontSize, "cỡ chữ của yêu cầu độ dài").toBeGreaterThanOrEqual(14);
  });
});

test.describe("UIUX-M28 — kích thước control", () => {
  test("control đủ ngưỡng theo loại con trỏ", async ({ page }) => {
    await open(page, "/login");

    // `DS-034`: cảm ứng 44px (WCAG 2.5.5), chuột 24px (WCAG 2.5.8 — mức AA).
    const coarse = await page.evaluate(
      () => matchMedia("(pointer: coarse)").matches,
    );
    const min = coarse ? 44 : 24;

    // Baseline: link "Quên mật khẩu?" đo được 111×20px trên desktop — chiều cao
    // hụt ngưỡng 24px. Trên Pixel 7 thì luật `pointer: coarse` đã nâng sẵn 44px.
    const undersized = await page
      .locator("main a[href], main button:not([disabled]), main input")
      .evaluateAll((els, limit) =>
        els.flatMap((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return [];
          return r.width < limit || r.height < limit
            ? [
                {
                  name:
                    el.getAttribute("aria-label") ||
                    el.textContent?.trim() ||
                    (el as HTMLInputElement).id ||
                    el.tagName,
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                },
              ]
            : [];
        }),
      min);

    expect(undersized, `ngưỡng ${min}px (${coarse ? "cảm ứng" : "chuột"})`).toEqual(
      [],
    );
  });
});
