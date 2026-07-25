import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * `P17-T1` — Trang flashcard CÔNG KHAI `/t/<mã>` (`D-36`).
 *
 * 🔴 ĐIỀU KIỆN CỨNG CỦA CẢ FILE: mọi bài đọc trang công khai phải chạy trong
 * **browser context KHÔNG cookie**. Tái dùng context đã đăng nhập thì bài kiểm
 * chỉ chứng minh "người đã đăng nhập xem được" — đúng thứ tính năng này KHÔNG
 * đòi hỏi, và sẽ bỏ lọt đúng cái lỗi nguy hiểm nhất (trang lặng lẽ phụ thuộc
 * phiên).
 *
 * Bộ thẻ dùng chung `seed.dev.sql` (buổi 1 của `VCB-BANK`, mã `qr7dem3k5np2`).
 */

const DB = "supabase_db_Polymind_Chinese";

/** Liên kết công khai mẫu do `seed.dev.sql` dựng. */
const SEEDED_TOKEN = "qr7dem3k5np2";
const SECTION_1 = "a1100000-0000-4000-8000-000000000001";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";

/** Mã đúng hình dạng nhưng không tồn tại. */
const NONEXISTENT_TOKEN = "zzzzzzzzzzzz";

/**
 * Buổi + liên kết RIÊNG của file này, cho bài thu hồi.
 *
 * Không mượn buổi 1 của seed: `ux_flashcard_public_links_active_section` chỉ
 * cho MỖI buổi một liên kết còn hiệu lực (đúng thiết kế), nên cắm thêm một
 * liên kết vào buổi 1 sẽ đỏ ngay ở fixture. Và thu hồi chính liên kết seed thì
 * để lại rác cho các lượt chạy sau nếu bài kiểm chết giữa chừng.
 */
const DECK = "a1000000-0000-4000-8000-000000000001";
const REVOKE_SECTION = "e5100000-0000-4000-8000-000000000001";
const REVOKE_LINK_ID = "e5000000-0000-4000-8000-000000000001";
const REVOKE_TOKEN = "e5test3k5np2";
const OWNER = `${ADMIN_ID}/${DECK}/${REVOKE_SECTION}`;

/**
 * Sáu bề rộng điện thoại thật, từ máy nhỏ nhất còn dùng tới máy lớn nhất.
 *
 * MỖI bề rộng là MỘT bài riêng, không gộp vòng lặp vào một `test()`: bài học từ
 * `admin-responsive` (đợt 9) là gộp nhiều màn vào một bài thì vừa hết ngân sách
 * 90s vừa không biết chỗ nào đỏ.
 */
const PHONE_WIDTHS = [
  { name: "320 — iPhone SE đời 1 / Android cũ", width: 320, height: 568 },
  { name: "360 — đa số Android", width: 360, height: 800 },
  { name: "375 — iPhone SE 2/3", width: 375, height: 667 },
  { name: "390 — iPhone 12–16", width: 390, height: 844 },
  { name: "414 — iPhone Plus", width: 414, height: 736 },
  { name: "430 — iPhone Pro Max", width: 430, height: 932 },
] as const;

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/**
 * `flashcard_pages` có trigger chặn DELETE cứng (thiết kế: admin lưu trữ chứ
 * không xoá). Fixture thì phải xoá thật — tắt trigger trong một giao dịch, đúng
 * cách `flashcard-responsive.spec.ts` làm.
 */
function purgeRevokeFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.flashcard_public_links where section_id = '${REVOKE_SECTION}';
    delete from public.flashcard_pages where section_id = '${REVOKE_SECTION}';
    delete from public.flashcard_sections where id = '${REVOKE_SECTION}';
    set session_replication_role = origin;
  `);
}

function createRevokeFixture() {
  purgeRevokeFixture();
  sql(`
    -- Trigger app.force_flashcard_actor() lấy người tạo từ auth.uid() và ném
    -- lỗi khi không xác định được (đúng bài học BUG_M06_01: không bao giờ đoán
    -- actor). Chạy bằng psql thì không có JWT, nên phải cắm claims vào.
    select set_config(
      'request.jwt.claims',
      '{"sub":"${ADMIN_ID}","role":"authenticated"}',
      true
    );

    insert into public.flashcard_sections (id, deck_id, session_number, title)
    -- Số buổi phải nằm trong courses.default_session_count (VCB-BANK = 35);
    -- seed đã dùng buổi 1 và 2 nên lấy 35 cho khỏi đụng.
    values ('${REVOKE_SECTION}', '${DECK}', 35, 'Buổi E2E thu hồi');

    insert into public.flashcard_pages (
      id, section_id, kind, order_index, hanzi, pinyin_syllables, meaning_vi,
      front_image_path, back_image_path, audio_path, front_alt, back_alt
    )
    values
      ('e5200000-0000-4000-8000-000000000001', '${REVOKE_SECTION}',
       'session_cover', 0, null, null, null,
       '${OWNER}/e5200000-0000-4000-8000-000000000001/front-e5300000-0000-4000-8000-000000000001.png',
       '${OWNER}/e5200000-0000-4000-8000-000000000001/back-e5300000-0000-4000-8000-000000000002.png',
       null, 'bìa trước E2E', 'bìa sau E2E'),
      ('e5200000-0000-4000-8000-000000000002', '${REVOKE_SECTION}',
       'vocabulary', 1, '存款', 'cún kuǎn', 'Tiền gửi',
       null, null,
       '${OWNER}/e5200000-0000-4000-8000-000000000002/audio-e5300000-0000-4000-8000-000000000003.mp3',
       null, null);

    update public.flashcard_sections
    set status = 'published', published_at = now()
    where id = '${REVOKE_SECTION}';

    insert into public.flashcard_public_links (id, section_id, token, label, created_by)
    values ('${REVOKE_LINK_ID}', '${REVOKE_SECTION}', '${REVOKE_TOKEN}', 'E2E thu hồi', '${ADMIN_ID}');
  `);
}

/**
 * Ảnh của bộ thẻ seed chỉ có HÀNG trong `storage.objects`, không có byte, nên
 * mỗi `<img>` là một request treo và chúng tích luỹ làm nghẽn `next dev` (đúng
 * nguyên nhân đã truy ra ở `P16-T8`). Chặn GET là gỡ đúng gốc — việc KÝ url
 * diễn ra phía máy chủ nên không bị ảnh hưởng, và bài kiểm dưới đây soi thuộc
 * tính `src` chứ không soi byte.
 */
async function blockMediaBytes(page: Page) {
  await page.route("**/storage/v1/**", (route) => route.abort());
}

/**
 * Mặt thẻ ĐANG hiện, không phải bản ẩn.
 *
 * `FlashcardSizer` dựng cả hai mặt một lần nữa trong luồng nhưng `invisible` —
 * đó là cách thẻ tự nở theo chữ. Hệ quả: mọi chuỗi trên thẻ tồn tại 2-3 lần
 * trong DOM, và `getByText(...).first()` bắt trúng bản ẩn rồi đỏ với lý do sai
 * ("unexpected value hidden"). Chỉ `FlashcardFaceShell` mới mang
 * `data-face-side`, nên nó là mỏ neo duy nhất trỏ đúng mặt thật.
 */
function faceSide(page: Page, side: "front" | "back") {
  return page.locator(`[data-face-side="${side}"]`);
}

/** Context sạch tinh: không cookie, không storage — đúng máy học sinh vừa quét mã. */
async function anonymousPage(
  browser: Browser,
  viewport?: { width: number; height: number },
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    ...(viewport ? { viewport } : {}),
  });
  const page = await context.newPage();
  await blockMediaBytes(page);
  return { page, close: () => context.close() };
}

test.beforeAll(() => {
  createRevokeFixture();
});

test.afterAll(() => {
  purgeRevokeFixture();
});

test.describe("trang flashcard công khai", () => {
  test("khách chưa đăng nhập vào thẳng, không bị đá về /login và không bị đặt phiên", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await blockMediaBytes(page);

    const response = await page.goto(`/t/${SEEDED_TOKEN}`);

    expect(response?.status()).toBe(200);
    // Không redirect: middleware phải nhận `/t` là đường công khai.
    expect(new URL(page.url()).pathname).toBe(`/t/${SEEDED_TOKEN}`);
    await expect(
      page.getByRole("heading", { name: /Buổi 1/ }),
    ).toBeVisible();

    // Vỏ dashboard không được xuất hiện — nó kéo theo `requireUser()`.
    await expect(page.locator("[data-dashboard-shell]")).toHaveCount(0);

    // 🔴 Bằng chứng trang KHÔNG tự tạo phiên cho khách vãng lai.
    const cookies = await context.cookies();
    expect(cookies.filter((c) => c.name.startsWith("sb-"))).toHaveLength(0);

    await context.close();
  });

  test("lật thẻ thấy nghĩa tiếng Việt, và không có tính năng cá nhân nào", async ({
    browser,
  }) => {
    const { page, close } = await anonymousPage(browser);
    await page.goto(`/t/${SEEDED_TOKEN}`);

    // Trang mở đầu là thẻ 1 → sang thẻ 2 mới là từ vựng.
    await page.getByRole("button", { name: "Thẻ tiếp theo" }).click();
    // Mặt TRƯỚC thẻ từ vựng có nghĩa tiếng Việt; trang mở đầu thì không, nên
    // chuỗi này phân biệt được đúng thẻ. Không neo vào "银行": pinyin căn trên
    // TỪNG chữ Hán nên DOM là "yín银háng行", hai chữ Hán không liền mạch.
    await expect(faceSide(page, "front")).toContainText("Ngân hàng");

    await page.getByRole("button", { name: "Lật thẻ" }).click();
    // `data-face` phản ánh TRẠNG THÁI lật; hai mặt đều nằm trong DOM (bắt buộc,
    // để lật 3D được) nên không thể dựa vào "thấy được hay không".
    await expect(page.locator('[data-face="back"]')).toHaveCount(1);
    await expect(faceSide(page, "back")).toContainText("Ngân hàng");
    await expect(faceSide(page, "back")).toContainText("Câu ví dụ");

    // Assert NGƯỢC: ★ và tiến độ cá nhân đã bị bỏ hẳn khỏi trang công khai.
    await expect(page.getByRole("button", { name: /Đánh dấu khó/ })).toHaveCount(
      0,
    );
    await expect(page.getByText("Đánh dấu khó")).toHaveCount(0);

    await close();
  });

  test("media được KÝ cho khách vãng lai — chứng minh policy Storage cho anon có tác dụng", async ({
    browser,
  }) => {
    const { page, close } = await anonymousPage(browser);
    await page.goto(`/t/${SEEDED_TOKEN}`);

    /*
     * Soi thuộc tính `src`, không soi byte: bộ thẻ seed chỉ có hàng trong
     * `storage.objects` chứ không có nội dung file, nên không có gì để tải về.
     *
     * Nhưng đây vẫn là bài kiểm THẬT: `signPaths()` ký bằng chính client của
     * người gọi. Nếu policy `flashcard_media_public_link_read` không áp cho
     * `anon`, nó trả Map rỗng → `frontUrl` là null → khối ảnh render ra chữ
     * "Không tải được ảnh" và KHÔNG có `src` nào. Có URL đã ký = policy chạy.
     *
     * (Vế "thu hồi cắt luôn media" được chứng minh ở pgTAP bài 25, nơi gọi
     * thẳng `share.can_read_public_flashcard_media` — chỗ đó đo được chính xác,
     * còn ở đây URL của object rỗng thì trước hay sau thu hồi đều lỗi như nhau
     * nên không phân biệt được.)
     */
    const src = await page
      .locator("img")
      .first()
      .getAttribute("src", { timeout: 15_000 });

    expect(src, "khách vãng lai phải nhận được URL đã ký").toBeTruthy();
    expect(src).toContain("/storage/v1/object/sign/flashcard-media/");
    expect(src).toContain("token=");

    await close();
  });

  test("mã bịa trả về trang hết hiệu lực", async ({ browser }) => {
    const { page, close } = await anonymousPage(browser);
    const response = await page.goto(`/t/${NONEXISTENT_TOKEN}`);

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Liên kết không còn hiệu lực" }),
    ).toBeVisible();
    await close();
  });

  test("thu hồi có hiệu lực ngay ở lượt quét kế tiếp, và câu trả lời giống hệt mã bịa", async ({
    browser,
  }) => {
    const { page, close } = await anonymousPage(browser);

    await page.goto(`/t/${REVOKE_TOKEN}`);
    await expect(
      page.getByRole("heading", { name: /Buổi E2E thu hồi/ }),
    ).toBeVisible();

    sql(`
      select set_config(
        'request.jwt.claims',
        '{"sub":"${ADMIN_ID}","role":"authenticated"}',
        true
      );
      select public.revoke_flashcard_public_link('${REVOKE_LINK_ID}');
    `);

    const after = await page.goto(`/t/${REVOKE_TOKEN}`);
    expect(after?.status()).toBe(404);

    // Không có "máy đo" cho người dò mã: mã đã thu hồi và mã bịa phải cho ra
    // đúng một câu trả lời.
    const revokedBody = await page.locator("main").innerText();
    await page.goto(`/t/${NONEXISTENT_TOKEN}`);
    const bogusBody = await page.locator("main").innerText();
    expect(revokedBody).toBe(bogusBody);

    await close();
  });

  test("người ĐANG đăng nhập quét mã vẫn xem được, media vẫn được ký", async ({
    browser,
  }) => {
    // Bẫy đã né bằng `createPublicClient()`: nếu trang công khai dùng client đọc
    // cookie thì vai trở thành `authenticated`, RPC bị từ chối và ảnh/audio
    // trắng trơn KHÔNG một thông báo lỗi nào.
    const context = await browser.newContext();
    const page = await context.newPage();
    await blockMediaBytes(page);

    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL("**/student");

    await page.goto(`/t/${SEEDED_TOKEN}`);
    await expect(page.getByRole("heading", { name: /Buổi 1/ })).toBeVisible();

    const src = await page
      .locator("img")
      .first()
      .getAttribute("src", { timeout: 15_000 });
    expect(src).toContain("/storage/v1/object/sign/flashcard-media/");

    await context.close();
  });

  test("không lỗi a11y", async ({ browser }) => {
    const { page, close } = await anonymousPage(browser);
    await page.goto(`/t/${SEEDED_TOKEN}`);
    await expect(page.getByRole("heading", { name: /Buổi 1/ })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    await close();
  });
});

/**
 * Bố cục điện thoại — phần user nhấn mạnh nhất.
 *
 * Ba khẳng định cho mỗi bề rộng, mỗi cái chặn một lỗi cụ thể:
 *   1. không cuộn ngang — chữ Hán cỡ lớn tràn ra là lỗi kinh điển ở 320px;
 *   2. thanh điều khiển nằm TRỌN trong màn — thiếu `min-h-0` trên vùng thẻ thì
 *      thẻ dài đẩy nó ra ngoài, và đó là lỗi im lặng (trang vẫn "chạy");
 *   3. nút bấm đủ 44px.
 */
test.describe("vừa mọi kích thước điện thoại", () => {
  for (const phone of PHONE_WIDTHS) {
    test(`${phone.name}`, async ({ browser }) => {
      const { page, close } = await anonymousPage(browser, {
        width: phone.width,
        height: phone.height,
      });
      await page.goto(`/t/${SEEDED_TOKEN}`);
      await expect(page.getByRole("heading", { name: /Buổi 1/ })).toBeVisible();

      // Sang thẻ từ vựng — đây mới là thẻ có chữ Hán cỡ lớn dễ tràn.
      await page.getByRole("button", { name: "Thẻ tiếp theo" }).click();
      await expect(faceSide(page, "front")).toContainText("Ngân hàng");

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollWidth,
        `tràn ngang ở ${phone.width}px`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const flip = page.getByRole("button", { name: "Lật thẻ" });
      const box = await flip.boundingBox();
      expect(box, "không thấy nút Lật thẻ").not.toBeNull();
      expect(
        box!.y + box!.height,
        `thanh điều khiển bị đẩy khỏi màn ở ${phone.width}px`,
      ).toBeLessThanOrEqual(phone.height + 1);
      expect(box!.height, "nút chính phải đủ 44px").toBeGreaterThanOrEqual(44);

      // Lật được ở mọi bề rộng, và mặt sau cũng không tràn.
      await flip.click();
      await expect(page.locator('[data-face="back"]')).toHaveCount(1);
      const afterFlip = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(afterFlip).toBeLessThanOrEqual(overflow.clientWidth + 1);

      await close();
    });
  }

  test("xoay ngang 667×375 vẫn dùng được", async ({ browser }) => {
    const { page, close } = await anonymousPage(browser, {
      width: 667,
      height: 375,
    });
    await page.goto(`/t/${SEEDED_TOKEN}`);
    await expect(page.getByRole("heading", { name: /Buổi 1/ })).toBeVisible();

    for (const name of ["Thẻ trước", "Lật thẻ", "Thẻ tiếp theo"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box, `mất nút "${name}" khi nằm ngang`).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(376);
    }

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(668);
    await close();
  });

  test("màn ngắn 375×530 vẫn thấy thanh điều khiển", async ({ browser }) => {
    // Xấp xỉ viewport thật của iPhone SE sau khi trừ thanh địa chỉ Safari.
    const { page, close } = await anonymousPage(browser, {
      width: 375,
      height: 530,
    });
    await page.goto(`/t/${SEEDED_TOKEN}`);
    await page.getByRole("button", { name: "Thẻ tiếp theo" }).click();
    await page.getByRole("button", { name: "Lật thẻ" }).click();

    const box = await page
      .getByRole("button", { name: "Lật thẻ" })
      .boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(531);
    await close();
  });
});
