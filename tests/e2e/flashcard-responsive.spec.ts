import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 16 — Flashcard.
 *
 * Gom bốn món E2E mà `P16-T3`/`T5`/`T6`/`T7` còn nợ, cộng baseline đo bề rộng
 * của `P16-T8`. Gom vào một file vì cả bốn đều cần đúng một bộ dữ liệu (bộ thẻ
 * mẫu ở `seed.dev.sql`), dựng lại bốn lần là bốn lần chờ.
 *
 * ⚠️ `DS-038` luật (1): chờ **nội dung thật của đúng màn đang đo**, không chờ
 * `networkidle`, và mỏ neo chờ không được là thứ chính bài kiểm đang kiểm.
 */

const DB = "supabase_db_Polymind_Chinese";

/** Bộ thẻ mẫu do `seed.dev.sql` dựng — không phải fixture của riêng file này. */
const SECTION_2 = "a1100000-0000-4000-8000-000000000002";

const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

function sql(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      DB,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-A",
      "-t",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}

/**
 * `seed.sql` không chỉ định `courses.id`, nên UUID đổi sau mỗi `db reset`.
 * Tra theo khóa nghiệp vụ ổn định đúng `DS-040`; ghim UUID làm suite chỉ xanh
 * trên đúng database cũ và còn khiến chính `seed.dev.sql` không nạp được.
 */
function requiredCourseId(code: string): string {
  const id = sql(
    `select id from public.courses where code = '${code.replaceAll("'", "''")}';`,
  );
  if (!id) {
    throw new Error(`Không tìm thấy khóa học fixture ${code} — seed đã đổi?`);
  }
  return id;
}

/**
 * Xoá thẻ test do file này tạo.
 *
 * `flashcard_pages` có trigger `guard_flashcard_page_history` chặn DELETE cứng
 * (thiết kế: admin phải lưu trữ, không xoá). Fixture test thì cần xoá thật, nên
 * tắt trigger trong một giao dịch — đúng cách `student-review-responsive` làm.
 */
function purgeTestPages(hanziList: string[]) {
  const values = hanziList.map((hanzi) => `'${hanzi}'`).join(", ");
  sql(`
    set session_replication_role = replica;
    delete from public.flashcard_pages
    where section_id = '${SECTION_2}' and hanzi in (${values});
    set session_replication_role = origin;
  `);
}

/**
 * Chặn mọi request tới media Storage.
 *
 * Bộ thẻ mẫu (seed) chỉ có HÀNG trong `storage.objects` chứ không có byte, nên
 * mỗi `<img src=signedURL>` là một request treo/trả lỗi. Qua nhiều test, chúng
 * tích luỹ và làm `next dev` nghẽn — chính vì thế lượt trước có bài chết ở tận
 * trang **đăng nhập** (không dính gì flashcard). Test này đo BỐ CỤC và CHỮ, không
 * cần byte ảnh, nên chặn từ trình duyệt là cách gỡ đúng gốc. Việc ký URL diễn ra
 * phía máy chủ nên không bị ảnh hưởng.
 */
async function blockMedia(page: Page) {
  await page.route("**/storage/v1/**", (route) => route.abort());
}

async function loginStudent(page: Page) {
  await blockMedia(page);
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
}

async function loginAdmin(page: Page) {
  await blockMedia(page);
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("admin@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin");
}

/**
 * Mở tab Flashcard của màn Ôn tập và chờ **thẻ thật** hiện ra.
 *
 * Mỏ neo là nút lật thẻ chứ không phải `<h1>`: `<h1>` do layout cấp nên nó hiện
 * trước cả khi bộ thẻ về, đúng cái bẫy `DS-038` mô tả.
 */
/**
 * Từ trang mở đầu sang thẻ từ vựng đầu tiên (trang 2).
 *
 * Bọc click trong `toPass`: cú click đầu có thể rơi vào lúc React **chưa hydrate
 * xong** — nhất là khi máy bận — nên `onClick` chưa gắn và cú click bị mất, trang
 * đứng ở bìa. Thử lại tới khi bộ đếm trang báo đã sang thật, thay vì click một
 * lần rồi hy vọng. Đây là chờ tính TƯƠNG TÁC ĐƯỢC, không phải nới cho xanh.
 */
async function goToFirstVocabulary(page: Page) {
  await expect(async () => {
    await page
      .getByRole("button", { name: "Trang flashcard tiếp theo" })
      .click();
    await expect(page.getByText(/Trang 2\/\d+/)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45_000 });
  // Chờ hoạt ảnh chuyển trang lắng hẳn trước khi đọc nội dung thẻ mới.
  await expect(page.locator("[data-page-transition]")).toHaveCount(0);
}

/**
 * Đọc nhãn (aria-label) của từng thẻ theo thứ tự hiện tại, đi từ trang 1 đến hết.
 *
 * Chờ hoạt ảnh chuyển trang LẮNG trước mỗi lần đọc/kiểm nút: nút "tiếp theo" bị
 * `disabled` trong lúc transition (theo thiết kế), nên kiểm `isDisabled` giữa
 * transition sẽ tưởng đã hết trang và dừng sớm.
 */
async function readCardOrder(page: Page): Promise<string[]> {
  const names: string[] = [];
  for (let pageNum = 1; ; pageNum += 1) {
    await expect(page.getByText(new RegExp(`Trang ${pageNum}/`))).toBeVisible();
    await expect(page.locator("[data-page-transition]")).toHaveCount(0);
    const label = await page
      .getByRole("button", { name: /^Mặt (trước|sau) của / })
      .first()
      .getAttribute("aria-label");
    names.push(label ?? "");
    const next = page.getByRole("button", {
      name: "Trang flashcard tiếp theo",
    });
    if (await next.isDisabled()) break;
    await expect(async () => {
      await next.click();
      await expect(
        page.getByText(new RegExp(`Trang ${pageNum + 1}/`)),
      ).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15_000 });
  }
  return names;
}

async function openStudentFlashcards(page: Page, budgetMs = 60_000) {
  // ⚠️ `waitUntil: "domcontentloaded"`, KHÔNG để mặc định "load". Ảnh của bộ thẻ
  // mẫu (seed) chỉ có hàng trong `storage.objects` mà không có byte, nên chờ
  // "load" là chờ những `<img>` không bao giờ tải xong — đúng cái bẫy `DS-038`
  // cấm. Mỏ neo thật là nút lật thẻ, không phải sự kiện "load".
  //
  // Bọc trong `toPass` vì cú `goto` ngay sau khi đăng nhập đôi lúc bị huỷ
  // (`net::ERR_ABORTED`) do đua với client-navigation của luồng login — thử lại
  // là cách xử lý đúng cho một cú abort điều hướng thoáng qua, không dính sản phẩm.
  // `budgetMs` rộng hơn cho lần mở trong CONTEXT MỚI (dev server biên dịch lại route).
  await expect(async () => {
    await page.goto("/student/review", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: /^Mặt (trước|sau) của / }).first(),
    ).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: budgetMs });
}

/** Không có phần tử nào đẩy trang rộng hơn khung nhìn. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

test.describe("Flashcard — học viên", () => {
  for (const viewport of viewports) {
    test(`không tràn ngang ở ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await loginStudent(page);
      await openStudentFlashcards(page);

      expect(await horizontalOverflow(page)).toBe(0);
    });
  }

  test("thẻ dựng bằng CHỮ: pinyin căn trên từng chữ Hán, mặt sau đủ 4 khối", async ({
    page,
  }) => {
    await loginStudent(page);
    await openStudentFlashcards(page);

    // Sang thẻ từ vựng đầu tiên (trang 1 là trang mở đầu).
    await goToFirstVocabulary(page);
    const front = page.locator(
      '[data-transition-layer="incoming"] [data-face-side="front"]',
    );
    await expect(front.getByText("银", { exact: true })).toBeVisible();
    await expect(front.getByText("行", { exact: true })).toBeVisible();
    await expect(front.getByText("yín", { exact: true })).toBeVisible();
    await expect(front.getByText("háng", { exact: true })).toBeVisible();
    await expect(front.getByText("Ngân hàng")).toBeVisible();

    const back = page.locator(
      '[data-transition-layer="incoming"] [data-face-side="back"]',
    );
    // Khối 1 (đầu thẻ): pinyin viết liền, dẫn xuất từ dạng tách. Neo vào đúng
    // cụm "银行 — yínháng" chứ không phải mọi chỗ có "yínháng" (câu ví dụ và cụm
    // từ cũng chứa chuỗi đó).
    await expect(back.getByText("银行 — yínháng")).toBeVisible();
    // Khối "Câu ví dụ" và "Cụm từ thường dùng".
    await expect(back.getByText("我去银行取钱。")).toBeVisible();
    await expect(back.getByText(/thẻ ngân hàng/)).toBeVisible();
    // ⛔ Khối "Tách nghĩa" đã bỏ (user chốt 2026-07-24). Ghim chiều phủ định
    // NGAY TRÊN MẶT THẺ THẬT: seed vẫn còn dữ liệu tách nghĩa ở cột cũ, nên nếu
    // ai đó dựng lại khối này thì bài đỏ chứ không im lặng.
    await expect(back.getByText("Tách nghĩa")).toHaveCount(0);
    await expect(back.getByText(/kim loại bạc/)).toHaveCount(0);
  });

  test("chữ KHÔNG bị cắt: thẻ cao đủ chứa nội dung mặt sau", async ({
    page,
  }) => {
    // Đây là lời than gốc của user. Trước Phase 16 thẻ là ảnh nên `object-cover`
    // cắt mất phần dưới; nay thẻ phải tự nở theo chữ.
    await page.setViewportSize({ width: 360, height: 800 });
    await loginStudent(page);
    await openStudentFlashcards(page);
    await goToFirstVocabulary(page);

    const back = page.locator(
      '[data-transition-layer="incoming"] [data-face-side="back"]',
    );
    const measured = await back.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    // Cho 2px dung sai cho làm tròn sub-pixel/viền. Đây KHÔNG phải nới cho xanh:
    // lỗi cũ (`object-cover`) cắt ~40% nội dung — hàng trăm px — nên 2px vẫn bắt
    // được lỗi thật mà không đỏ vì làm tròn.
    expect(measured.scrollHeight).toBeLessThanOrEqual(
      measured.clientHeight + 2,
    );
  });

  test("xáo trộn giữ trong phiên; đăng xuất rồi vào lại thì về thứ tự gốc", async ({
    page,
    browser,
  }) => {
    // Bài này làm HAI chu kỳ đăng nhập + đọc hết thẻ (phiên gốc và phiên mới),
    // gấp đôi việc một bài thường — 90s mặc định quá chặt trên `next dev`.
    test.setTimeout(180_000);
    await loginStudent(page);
    await openStudentFlashcards(page);

    await expect(page.getByText(/Trang \d+\/\d+/)).toBeVisible();

    const original = await readCardOrder(page);
    expect(original.length).toBeGreaterThan(2);

    await page.getByRole("button", { name: "Xáo trộn" }).click();
    await expect(
      page.getByText(/Thứ tự xáo trộn chỉ áp cho buổi này/),
    ).toBeVisible();

    // ⛔ Không được lưu ở bất cứ đâu ngoài bộ nhớ của trang đang mở.
    const storage = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    expect(storage.local).not.toContain("shuffle");
    expect(storage.session).not.toContain("shuffle");

    // Đăng xuất rồi đăng nhập lại — kịch bản `Q6` đòi dựng lại đúng. Dùng
    // CONTEXT MỚI (phiên trình duyệt sạch) thay vì `clearCookies` trên cùng page:
    // client Supabase còn giữ token trong bộ nhớ sau khi xoá cookie nên đăng nhập
    // lại tại chỗ dễ rối điều hướng. Thứ tự xáo trộn nằm trong state React nên
    // phiên mới chắc chắn không thấy nó (đã kiểm không có ở localStorage/session).
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await loginStudent(freshPage);
    // Context mới => dev server biên dịch lại route: cho ngân sách mở rộng hơn.
    await openStudentFlashcards(freshPage, 100_000);
    const afterRelogin = await readCardOrder(freshPage);
    await freshContext.close();

    expect(afterRelogin).toEqual(original);
  });

  test("★ đánh dấu thẻ khó ghi xuống DB và đọc lại được sau khi tải lại", async ({
    page,
  }) => {
    // Mở màn Ôn tập HAI lần (đánh dấu rồi tải lại) — gấp đôi việc, 90s quá chặt
    // trên `next dev`.
    test.setTimeout(150_000);
    sql(`delete from public.flashcard_starred_pages;`);

    await loginStudent(page);
    await openStudentFlashcards(page);
    await goToFirstVocabulary(page);

    await page.getByRole("button", { name: "Đánh dấu khó" }).click();
    await expect(
      page.getByRole("button", { name: "Đã đánh dấu khó" }),
    ).toBeVisible();

    await expect
      .poll(() => sql(`select count(*) from public.flashcard_starred_pages;`), {
        timeout: 10_000,
      })
      .toBe("1");

    // Tải lại: trạng thái phải đến từ DB chứ không phải state của trang.
    await openStudentFlashcards(page);
    await goToFirstVocabulary(page);
    await expect(
      page.getByRole("button", { name: "Đã đánh dấu khó" }),
    ).toBeVisible();

    sql(`delete from public.flashcard_starred_pages;`);
  });

  test("sạch axe ở 360 và 1280", async ({ page }) => {
    // Đăng nhập MỘT lần: gọi `loginStudent` lần hai khi đã đăng nhập thì `/login`
    // chuyển hướng sang `/student`, không còn ô "Tên đăng nhập" để điền.
    await loginStudent(page);
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await openStudentFlashcards(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((violation) => violation.id),
        `axe ở ${width}px`,
      ).toEqual([]);
    }
  });
});

test.describe("Flashcard — quản trị", () => {
  test.beforeEach(() => {
    // ⚠️ Danh sách này phải gồm MỌI Hán tự mà các bài dưới tạo ra. Từ khi bảng
    // xem trước biết trước thẻ đã tồn tại (`D-35` điểm 3), một thẻ sót lại từ
    // project chạy trước sẽ bị đếm là "trùng — bỏ qua" và làm lệch con số
    // "N dòng sẵn sàng" ở project sau. Thiếu 汇款单/存单 đúng là cách bài này
    // đỏ ở project `mobile` trong khi `chromium` xanh.
    purgeTestPages(["测试", "新词", "汇率", "汇款单", "存单"]);
  });

  async function openAdminDeck(page: Page) {
    const courseId = requiredCourseId("VCB-BANK");
    await page.goto(`/admin/flashcards?course=${courseId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: /Flashcard — Tiếng Trung ngân hàng/ }),
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Mở khu soạn của Buổi 2 (buổi nháp). Bọc cú click "Buổi 2" trong `toPass`:
   * nếu click rơi vào lúc chưa hydrate thì nó bị mất, workspace đứng ở Buổi 1
   * (published, KHÔNG có nút "Nhập hàng loạt") — cùng kiểu race như click "next".
   * Nút "Nhập hàng loạt" chỉ hiện với buổi nháp nên là mỏ neo đúng.
   */
  async function openDraftSection(page: Page) {
    await expect(async () => {
      await page.getByRole("button", { name: "Buổi 2" }).click();
      await expect(
        page.getByRole("button", { name: "Nhập hàng loạt" }),
      ).toBeVisible({ timeout: 8000 });
    }).toPass({ timeout: 60_000 });
  }

  for (const viewport of [viewports[0], viewports[5]]) {
    test(`không tràn ngang ở ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await loginAdmin(page);
      await openAdminDeck(page);
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }

  test("nhập hàng loạt: xem trước theo dòng, tạo thẻ thật, dán lại KHÔNG nhân đôi", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAdmin(page);
    await openAdminDeck(page);
    await openDraftSection(page);
    const importButton = page.getByRole("button", { name: "Nhập hàng loạt" });

    const before = sql(
      `select count(*) from public.flashcard_pages where section_id = '${SECTION_2}';`,
    );

    await importButton.click();
    await page.getByLabel("Danh sách thẻ").fill(
      [
        "测试 | cè shì | Kiểm tra",
        "thiếu cột",
        "新词 | xīn cí | Từ mới",
        // Dòng 5 cột (`D-35` điểm 1): 2 câu ví dụ + 1 cụm từ trên CÙNG một dòng.
        "汇款单 | huì kuǎn dān | Giấy chuyển tiền | 请填写汇款单。~qǐng tiánxiě huìkuǎndān~Xin hãy điền giấy chuyển tiền.;;这是汇款单~zhè shì huìkuǎndān~Đây là giấy chuyển tiền | 汇款单号~huìkuǎndān hào~số giấy chuyển tiền",
      ].join("\n"),
    );

    // Báo lỗi THEO TỪNG DÒNG, không nuốt cả lô.
    await expect(
      page.getByText("3 dòng sẵn sàng · 1 dòng bị bỏ qua"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Tạo 3 thẻ" }).click();
    await expect(page.getByText(/Đã tạo 3 thẻ/)).toBeVisible();

    await expect
      .poll(() =>
        sql(
          `select count(*) from public.flashcard_pages where section_id = '${SECTION_2}';`,
        ),
      )
      .toBe(String(Number(before) + 3));

    // Hai danh sách con của dòng 5 cột phải NẰM TRONG DB, không rơi mất ở RPC.
    expect(
      sql(`
        select jsonb_array_length(example_sentences)
               || '|' || jsonb_array_length(common_phrases)
        from public.flashcard_pages
        where section_id = '${SECTION_2}' and hanzi = '汇款单';
      `),
    ).toBe("2|1");

    // 🔴 `BUG_M09_01` + `D-35` điểm 3: dán lại danh sách cũ thì thẻ đã tồn tại
    // bị bỏ qua CẢ KHỐI, và bảng xem trước phải nói ra ngay — không để admin bấm
    // rồi mới biết. Chặn cuối vẫn ở DB (unique index), pgTAP khoá riêng vế đó.
    await page.getByRole("button", { name: "Nhập hàng loạt" }).click();
    await page
      .getByLabel("Danh sách thẻ")
      .fill(
        ["测试 | cè shì | Kiểm tra", "存单 | cún dān | Sổ tiết kiệm"].join("\n"),
      );
    await expect(
      page.getByText("Trùng thẻ đã có trong buổi — bỏ qua."),
    ).toBeVisible();
    await expect(
      page.getByText("1 dòng sẵn sàng · 1 dòng bị bỏ qua"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Tạo 1 thẻ" }).click();
    await expect(page.getByText(/Đã tạo 1 thẻ/)).toBeVisible();

    // Đúng MỘT thẻ mới được thêm — dòng trùng không nhân đôi 测试.
    await expect
      .poll(() =>
        sql(
          `select count(*) from public.flashcard_pages where section_id = '${SECTION_2}';`,
        ),
      )
      .toBe(String(Number(before) + 4));
    expect(
      sql(`
        select count(*) from public.flashcard_pages
        where section_id = '${SECTION_2}' and hanzi = '测试';
      `),
    ).toBe("1");

    // Thẻ nhập hàng loạt chưa có audio — màn phải nói ra, không để admin đoán.
    await expect(page.getByText("Thiếu audio").first()).toBeVisible();
  });

  test("soạn một thẻ THẬT qua giao diện rồi đọc DB xác nhận", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await loginAdmin(page);
    await openAdminDeck(page);
    await openDraftSection(page);
    await page.getByRole("button", { name: "Thêm trang" }).click();

    // Buổi 2 của seed chưa có trang mở đầu nên dialog mặc định là "Trang mở đầu";
    // chọn thẳng "Thẻ từ vựng" để không phụ thuộc mặc định đó.
    await page.getByLabel("Loại trang").click();
    await page.getByRole("option", { name: "Thẻ từ vựng" }).click();

    await page.getByLabel("Hán tự *").fill("汇率");
    await page.getByLabel("Pinyin — tách theo âm tiết *").fill("huì lǜ");
    await page.getByLabel("Nghĩa tiếng Việt *").fill("Tỷ giá");

    // Một mục ở khối "Cụm từ thường dùng" để chứng minh jsonb đi đúng đường Zod.
    // (Trước 2026-07-24 bài này dùng khối "Tách nghĩa"; khối đó đã bị bỏ khỏi
    // sản phẩm nên phải đổi sang một danh sách con CÒN SỐNG — không được bỏ hẳn
    // vế kiểm jsonb, vì đó mới là thứ bài này sinh ra để canh.)
    await page.getByRole("button", { name: "Thêm cụm từ" }).click();
    await page.getByLabel("Cụm từ (Hán tự)").fill("汇率表");
    await page.getByLabel("Pinyin", { exact: true }).last().fill("huì lǜ biǎo");
    await page.getByLabel("Nghĩa tiếng Việt").last().fill("bảng tỷ giá");

    await page.getByRole("button", { name: "Lưu trang" }).click();
    await expect(page.getByText(/Đã thêm trang flashcard/)).toBeVisible();

    await expect
      .poll(() =>
        sql(`
          select hanzi || '|' || pinyin_syllables || '|' || meaning_vi
                 || '|' || jsonb_array_length(common_phrases)
          from public.flashcard_pages
          where section_id = '${SECTION_2}' and hanzi = '汇率';
        `),
      )
      .toBe("汇率|huì lǜ|Tỷ giá|1");

    purgeTestPages(["汇率"]);
  });

  test("sạch axe ở 1280", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAdmin(page);
    await openAdminDeck(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

test.afterAll(() => {
  // Bộ thẻ mẫu của seed phải nguyên vẹn cho lượt chạy sau — chỉ dọn thẻ test.
  purgeTestPages(["测试", "新词", "汇率"]);
  sql(`delete from public.flashcard_starred_pages;`);
});
