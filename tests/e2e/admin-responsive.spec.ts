import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P18-T2` … `P18-T14` — khu Quản trị (M01 → M12).
 *
 * Spec này khoá lại đúng những lỗi **đo được** ở đợt 9, để chúng không quay lại
 * một cách im lặng. Ba loại lỗi mà axe **không** bắt được nhưng đã có thật:
 *
 *  1. **Tràn ngang** — `/admin` 127px, `/admin/classes/[id]` 193px @360.
 *  2. **Không có heading cấp 2 nào** trên toàn bộ 13 bề mặt Quản trị, nên người
 *     dùng trình đọc màn hình không nhảy được giữa các khối trong trang.
 *  3. **Mất dữ liệu trên điện thoại** — bản `md:hidden` của 6 bảng bỏ bớt cột so
 *     với bản desktop (email, người giám hộ, số điện thoại, chuyên môn, học phí,
 *     số buổi, khai giảng, mã tài khoản), và **không lộ ra ở bất kỳ bài kiểm nào**
 *     vì mỗi bản đều "đúng" theo tiêu chí của chính nó.
 *
 * `DS-040`: không ghim UUID hàng seed — tra theo khóa nghiệp vụ ổn định.
 */

const DB = "supabase_db_Polymind_Chinese";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

const CLASS_ID = sql(`select id from public.classes where code = 'LOP-02';`);
const CLASS_NAME = sql(`select name from public.classes where code = 'LOP-02';`);
const COURSE_ID = sql(`select id from public.courses order by code limit 1;`);
const COURSE_TITLE = sql(`select title from public.courses order by code limit 1;`);
const ADMIN_NAME = sql(
  `select p.full_name from public.profiles p
     join auth.users u on u.id = p.id
    where u.email = 'admin@polymind.test';`,
);

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;

/**
 * 13 bề mặt thật của khu Quản trị. M06 Flashcard hoãn theo `DS-043`.
 *
 * `h1` là **mỏ neo nội dung** của từng màn — xem `goToSurface()`. Ba màn có
 * tiêu đề động thì tra từ DB theo khóa nghiệp vụ, không ghim chuỗi (`DS-040`).
 */
const SURFACES = [
  { module: "M01", name: "Tổng quan", path: "/admin", h1: `Xin chào, ${ADMIN_NAME}` },
  { module: "M02", name: "Học viên", path: "/admin/students", h1: "Học viên" },
  { module: "M03", name: "Giáo viên", path: "/admin/teachers", h1: "Giáo viên" },
  { module: "M04", name: "Khóa học", path: "/admin/courses", h1: "Khóa học" },
  { module: "M04", name: "Chi tiết khóa học", path: `/admin/courses/${COURSE_ID}`, h1: COURSE_TITLE },
  { module: "M05", name: "Lớp học", path: "/admin/classes", h1: "Lớp học" },
  { module: "M05", name: "Chi tiết lớp", path: `/admin/classes/${CLASS_ID}`, h1: CLASS_NAME },
  { module: "M07", name: "Lịch học", path: "/admin/schedule", h1: "Lịch học" },
  { module: "M08", name: "Học phí", path: "/admin/tuition", h1: "Học phí" },
  { module: "M09", name: "Báo cáo", path: "/admin/reports", h1: "Báo cáo học phí" },
  {
    module: "M10",
    name: "Duyệt câu hỏi",
    path: "/admin/question-bank-review",
    h1: "Duyệt kho câu hỏi chung",
  },
  { module: "M11", name: "Thông báo", path: "/admin/notifications", h1: "Thông báo" },
  { module: "M12", name: "Quản trị & Audit", path: "/admin/system", h1: "Quản trị & Audit" },
] as const;

const H1_BY_PATH = new Map<string, string>(SURFACES.map((s) => [s.path, s.h1]));

/**
 * Ngân sách cho mỏ neo nội dung — **không** dùng 5s mặc định của `expect`.
 *
 * Đây là chặng chờ "trang đã tới chưa", cùng loại với `page.goto` (mặc định 30s),
 * chứ không phải một khẳng định về sản phẩm. Đo trên máy rảnh: 13 màn đều về
 * trong **0,5–1,4s** ở cả Chromium lẫn Pixel 7, nặng nhất là `/admin/classes/[id]`
 * ~1,0–2,0s. Nhưng khi máy bận (hai project chạy nối nhau + Docker + `next dev`),
 * chính màn đó vượt 5s và bài kiểm đỏ vì **hết ngân sách chờ**, không phải vì
 * sản phẩm sai — đúng loại "đỏ giả" mà `DS-038` sinh ra để chặn.
 */
const CONTENT_TIMEOUT = 30_000;

/**
 * `<h1>` của error boundary `(dashboard)/error.tsx` (`DS-018`).
 *
 * 🔴 **Đây mới là nguyên nhân thật của "bài `heading` chập chờn" mà đợt 9 và
 * đợt 10 đều chẩn đoán trượt.** Khi truy vấn phía máy chủ `throw`, Next thay cả
 * thân trang bằng trang lỗi này — mà trang lỗi có **đúng một `<h1>` và không
 * `<h2>` nào**. Bài `heading đúng cấp` vì thế đọc ra `h1 = 1` (đạt) và `h2 = 0`
 * (đỏ), rồi báo cáo thành "màn Chi tiết lớp thiếu heading cấp 2" — trong khi
 * màn đó chưa từng được render. Bắt được nhờ ảnh chụp trạng thái lúc đỏ ở đợt
 * 11: `heading "Không tải được nội dung" [level=1]`.
 */
const ERROR_BOUNDARY_H1 = "Không tải được nội dung";

async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("admin@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/admin/);
}

/**
 * `DS-038` luật (1) — chờ **NỘI DUNG THẬT của đúng màn này**, không chờ mạng lặng.
 *
 * Bản cũ chờ `networkidle` rồi coi `<main>` hiện là xong. `<main>` do **layout**
 * cấp, còn thân trang về sau ở một đoạn stream riêng (ranh giới Suspense ngầm do
 * `(dashboard)/loading.tsx` tạo ra), nên "thấy `<main>`" **không** chứng minh
 * được gì về nội dung màn. Đo được: cùng một lệnh trên cùng một máy, bài
 * `heading đúng cấp` cho ra xanh **13,2s** → `--repeat-each=3` **3/3 đỏ** →
 * xanh **27,1s**; đợt 11 kiểm ngược lại bản cũ được **1/6 đỏ**.
 *
 * 🔴 **Chẩn đoán của đợt 10 ("đo giữa lúc RSC còn stream") mô tả chưa đúng bệnh.**
 * Đợt 11 chụp được trạng thái lúc đỏ: trang không hề "đang stream dở" mà đã
 * render **xong** — render ra **trang lỗi** `ERROR_BOUNDARY_H1`. Truy vấn phía
 * máy chủ `throw` khi máy kiệt tài nguyên, Next thay thân trang bằng error
 * boundary, và trang đó có **đúng một `<h1>`, không `<h2>` nào** — khớp chính
 * xác triệu chứng `h1 = 1 · h2 = 0` mà hai đợt trước quy cho sản phẩm. (Không
 * dựng lại được khi máy rảnh: 54/54 lượt điều hướng vào đúng ba route hay đỏ
 * đều ra trang thật.)
 *
 * Mỏ neo đúng vì thế gồm **hai vế**: `<h1>` phải xuất hiện, **và** phải đúng
 * chuỗi tiêu đề của chính màn này — vế thứ hai mới là vế bắt được trang lỗi và
 * bắt được "tàn dư của màn trước".
 *
 * ⚠️ Cố ý **không** neo vào `<h2>`: bài `heading đúng cấp` kiểm chính `<h2>`, neo
 * vào đó thì bài kiểm tự chứng minh mình — hết giờ thay vì báo `h2 = 0`.
 */
async function goToSurface(page: Page, path: string) {
  const pathname = path.split("?")[0]!;
  const expectedH1 = H1_BY_PATH.get(pathname);
  if (!expectedH1) {
    throw new Error(
      `goToSurface: chưa khai báo <h1> cho "${pathname}" — thêm bề mặt vào SURFACES trước.`,
    );
  }

  await page.goto(path);
  await expect(
    page.getByRole("status", { name: "Đang tải trang" }),
    `${pathname}: lớp phủ "Đang tải trang" chưa tắt`,
  ).toHaveCount(0, { timeout: CONTENT_TIMEOUT });

  // Chờ **một** `<h1>` bất kỳ chứ không chờ đúng chuỗi mong đợi: trang lỗi cũng
  // có `<h1>`, và ta cần đọc được nó để báo đúng bệnh thay vì báo "hết giờ".
  // Cố ý KHÔNG kiểm **số lượng** `<h1>` ở đây — đó là việc của bài `heading
  // đúng cấp`, kiểm ở đây thì bài kia không còn gì để chứng minh.
  await expect(
    page.getByRole("heading", { level: 1 }).first(),
    `${pathname}: sau ${CONTENT_TIMEOUT}ms vẫn chưa có <h1> nào — đoạn RSC của trang chưa về`,
  ).toBeVisible({ timeout: CONTENT_TIMEOUT });

  const titles = (await page.getByRole("heading", { level: 1 }).allInnerTexts()).map((t) =>
    t.trim(),
  );

  if (titles.includes(ERROR_BOUNDARY_H1)) {
    const code = await page
      .getByText(/^Mã lỗi:/)
      .innerText()
      .catch(() => "không có mã lỗi (digest rỗng)");
    throw new Error(
      `${pathname}: trang rơi vào ERROR BOUNDARY (\`DS-018\`), không phải màn thật — ${code}. ` +
        `Truy vấn phía máy chủ đã \`throw\`. ⚠️ Trang lỗi có đúng **một <h1> và không <h2> nào**, ` +
        `nên nếu cứ đo tiếp thì nó hiện ra dưới dạng "màn này thiếu <h2>" — tức đổ lỗi cho sản phẩm ` +
        `vì một sự cố lấy dữ liệu.`,
    );
  }

  expect(
    titles,
    `${pathname}: <h1> không phải của màn này (chờ "${expectedH1}")`,
  ).toContain(expectedH1);

  await waitForClientMeasurements(page, pathname);
}

/**
 * Chặng thứ hai: chờ **React hydrate xong** các vùng cuộn.
 *
 * Vì sao cần thêm một chặng nữa dù `<h1>` đã hiện: `DataTable` và
 * `ScrollableNav` đặt `tabIndex`/`role="region"` từ một `useEffect` +
 * `ResizeObserver` (`DS-038` luật 3 — chỉ gắn khi vùng **thật sự cuộn**, mà
 * "có cuộn hay không" chỉ biết được sau khi trình duyệt đã bố cục xong). HTML
 * từ máy chủ vì thế **luôn** ra `tabindex=null`. Đo ngay lúc `<h1>` hiện thì
 * đọc trúng trạng thái trước hydrate và báo 16 lỗi giả kiểu *"cuộn ngang được
 * nhưng tabindex = null"* — `networkidle` của bản cũ vô tình che chỗ này, nên
 * lỗi chỉ lộ ra khi bỏ nó đi.
 *
 * ⚠️ Cố ý **không** chờ chính `tabIndex` — bài kiểm ngay dưới và luật axe
 * `scrollable-region-focusable` đều kiểm đúng thuộc tính đó; chờ nó thì bài
 * kiểm tự chứng minh mình. Mốc dùng ở đây là **khóa fiber của React** trên
 * chính nút DOM đó, tức "React đã nhận nút này", nằm **trước** effect chứ
 * không phải kết quả của effect.
 *
 * Số đo (Chromium, máy rảnh, 5 màn × 2 vòng): fiber về sau `<h1>` **11–90ms**,
 * và `tabIndex` về sau fiber thêm **3–10ms** — nên hai nhịp khung hình ở dưới
 * là đủ, và tổng chi phí thêm chưa tới 0,1s mỗi lượt điều hướng.
 */
async function waitForClientMeasurements(page: Page, at: string) {
  await page.waitForFunction(
    () => {
      const targets = [
        ...document.querySelectorAll('[data-slot="data-table-scroller"]'),
        ...document.querySelectorAll("nav[aria-label]"),
      ];
      return targets.every((el) =>
        Object.keys(el).some(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"),
        ),
      );
    },
    undefined,
    { timeout: CONTENT_TIMEOUT },
  ).catch(() => {
    throw new Error(
      `${at}: vùng cuộn chưa được React hydrate sau ${CONTENT_TIMEOUT}ms — ` +
        `nếu React đổi tên khóa nội bộ (\`__reactFiber$\`) thì sửa mốc chờ ở đây.`,
    );
  });
  // Nhường hai nhịp khung hình để `useEffect` + `setState` kịp áp vào DOM.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe("Khu Quản trị — bố cục & khả năng tiếp cận", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  /*
   * MỘT bài kiểm cho MỖI màn, không gộp 13 màn × 6 bề rộng vào một bài.
   *
   * Bản đầu gộp hết thành một `test()` → **78 lượt điều hướng** trong ngân sách
   * 90s của một bài, và nó **hết giờ ngay cả khi máy rảnh** (đã thử: dừng hẳn
   * suite chạy nền rồi chạy lại, vẫn đỏ). Đó là bài kiểm hỏng chứ không phải sản
   * phẩm hỏng — và một bài "đỏ ngẫu nhiên" còn tệ hơn không có bài kiểm
   * (`DS-038`). Tách ra thì mỗi màn có ngân sách riêng, và khi đỏ thì tên bài đã
   * chỉ thẳng màn nào.
   */
  for (const surface of SURFACES) {
    test(`${surface.module} ${surface.name} — không tràn ngang ở sáu bề rộng`, async ({
      page,
    }) => {
      const overflows: string[] = [];

      for (const width of WIDTH_LADDER) {
        await page.setViewportSize({ width, height: 900 });
        await goToSurface(page, surface.path);

        const overflow = await page.evaluate(() => {
          const de = document.documentElement;
          return Math.max(0, de.scrollWidth - de.clientWidth);
        });

        if (overflow > 0) {
          overflows.push(`@${width}px tràn ${overflow}px`);
        }
      }

      expect(overflows, `${surface.path}: ${overflows.join(" · ")}`).toEqual([]);
    });
  }

  /*
   * Chỉ đòi `<h2>` ở màn có **nhiều khối nội dung**. Màn chỉ có đúng một bảng
   * (Học viên, Giáo viên, Lớp học…) thì `<h1>` + `<caption>` của bảng đã đủ mốc
   * điều hướng — thêm một heading nữa chỉ để test xanh là dựng giao diện phục vụ
   * bài kiểm, đúng thứ `AGENTS.md` cấm.
   *
   * Kiểm kê đo được ở đợt 11 (13 màn × 2 project × 2 vòng, kết quả trùng khít):
   * **7/13 màn có `<h2>`** — đúng bằng tập dưới đây — và 6 màn còn lại cố ý
   * không có. Nên phát biểu đúng là *"13/13 màn ĐẠT LUẬT"*, **không phải**
   * "13/13 màn có `<h2>`".
   */
  const MULTI_SECTION = new Set([
    "/admin",
    "/admin/courses",
    `/admin/courses/${COURSE_ID}`,
    `/admin/classes/${CLASS_ID}`,
    "/admin/tuition",
    "/admin/reports",
    "/admin/system",
  ]);

  /* Một bài mỗi màn — cùng lý do đã tách ba nhóm bài trên. */
  for (const surface of SURFACES) {
    test(`${surface.module} ${surface.name} — heading đúng cấp: một <h1>, màn nhiều khối phải có <h2>`, async ({
      page,
    }) => {
      const problems: string[] = [];

      await goToSurface(page, surface.path);

      const { h1, h2, skips } = await page.evaluate(() => {
        const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) =>
          Number(h.tagName[1]),
        );
        // Nhảy cấp (h1 → h3) làm người dùng trình đọc màn hình tưởng đã bỏ sót
        // một mục. `/admin/courses/[id]` từng nhảy đúng kiểu này.
        const skips: string[] = [];
        for (let i = 1; i < hs.length; i++) {
          const prev = hs[i - 1]!;
          const cur = hs[i]!;
          if (cur - prev > 1) skips.push(`h${prev}→h${cur}`);
        }
        return {
          h1: document.querySelectorAll("h1").length,
          h2: document.querySelectorAll("h2").length,
          skips,
        };
      });

      if (h1 !== 1) problems.push(`${surface.module} ${surface.name}: h1 = ${h1}`);
      if (MULTI_SECTION.has(surface.path) && h2 < 1) {
        problems.push(`${surface.module} ${surface.name}: h2 = 0 dù có nhiều khối`);
      }
      if (skips.length > 0) {
        problems.push(`${surface.module} ${surface.name}: nhảy cấp ${skips.join(", ")}`);
      }

      expect(problems, problems.join("\n")).toEqual([]);
    });
  }

  /*
   * MỘT bài cho MỖI màn — cùng lý do đã tách bài "tràn ngang" ở đợt 9.
   *
   * Bản gộp nhồi **13 màn × 2 bề rộng = 26 lượt điều hướng** vào một `test()`
   * ngân sách 90s, và đợt 11 đo được nó **hết giờ ngay ở `page.goto`** khi máy
   * bận — trong khi 39 bài còn lại đều xanh. Đó là bài kiểm hỏng, không phải sản
   * phẩm hỏng (`DS-038`). Tách ra thì mỗi màn có ngân sách riêng và tên bài đã
   * chỉ thẳng màn nào.
   */
  for (const surface of SURFACES) {
    test(`${surface.module} ${surface.name} — bảng có caption, th[scope] và cuộn được bằng bàn phím`, async ({
      page,
    }) => {
      const problems: string[] = [];

      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await goToSurface(page, surface.path);

        const tables = await page.evaluate(() => {
          return [...document.querySelectorAll('[data-slot="data-table"]')].map(
            (t) => {
              const scroller = t.closest('[data-slot="data-table-scroller"]')!;
              const ths = [...t.querySelectorAll("thead th")];
              return {
                caption: (t.querySelector("caption")?.textContent ?? "").trim(),
                ths: ths.length,
                thWithScope: ths.filter((th) => th.getAttribute("scope") === "col")
                  .length,
                scrolls: scroller.scrollWidth > scroller.clientWidth + 1,
                tabIndex: scroller.getAttribute("tabindex"),
                role: scroller.getAttribute("role"),
              };
            },
          );
        });

        for (const [i, t] of tables.entries()) {
          const at = `${surface.module} ${surface.name} @${width}px bảng #${i + 1}`;
          if (!t.caption) problems.push(`${at}: thiếu <caption>`);
          if (t.ths !== t.thWithScope) {
            problems.push(`${at}: ${t.ths - t.thWithScope}/${t.ths} th thiếu scope="col"`);
          }
          // Vùng cuộn CHỈ cần tới được bằng bàn phím khi nó thật sự cuộn
          // (`DS-038` luật 3) — gắn tabIndex cho vùng không cuộn chỉ tạo thêm
          // một chặng Tab vô nghĩa.
          if (t.scrolls && t.tabIndex !== "0") {
            problems.push(`${at}: cuộn ngang được nhưng tabindex = ${t.tabIndex}`);
          }
          if (t.scrolls && t.role !== "region") {
            problems.push(`${at}: cuộn ngang được nhưng không có role="region"`);
          }
          if (!t.scrolls && t.tabIndex === "0") {
            problems.push(`${at}: không cuộn mà vẫn chiếm một chặng Tab`);
          }
        }
      }

      expect(problems, problems.join("\n")).toEqual([]);
    });
  }

  /* Cũng tách một bài mỗi màn — quét axe còn tốn hơn cả điều hướng. */
  for (const surface of SURFACES) {
    test(`${surface.module} ${surface.name} — axe không còn vi phạm WCAG 2.1 AA`, async ({
      page,
    }) => {
      const found: string[] = [];

      for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await goToSurface(page, surface.path);
        // `DS-038` luật (2): chờ animation dừng rồi mới quét.
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
        );

        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        for (const v of result.violations) {
          found.push(
            `${surface.module} ${surface.name} @${width}px — ${v.id} (${v.impact}, ${v.nodes.length} node)`,
          );
        }
      }

      expect(found, found.join("\n")).toEqual([]);
    });
  }

  /**
   * Bài quan trọng nhất của đợt này: **không màn nào được giấu bớt dữ liệu trên
   * điện thoại**. Trước đây mỗi bảng có hai bản render và bản `md:hidden` thiếu
   * cột, nên thông tin biến mất mà không ai biết.
   */
  test("bảng trên điện thoại hiện đủ cột như trên máy tính", async ({ page }) => {
    const listSurfaces = [
      { path: "/admin/students", mustHave: ["Liên hệ", "Bậc hiện tại", "Tài khoản"] },
      { path: "/admin/teachers", mustHave: ["Liên hệ", "Chuyên môn", "Trạng thái"] },
      { path: "/admin/courses", mustHave: ["Học phí", "Số buổi", "Lớp đã mở"] },
      { path: "/admin/classes", mustHave: ["Khai giảng", "Giáo viên chính", "Sĩ số"] },
      { path: "/admin/system", mustHave: ["Mã", "Tên đăng nhập", "Liên hệ"] },
    ];

    const problems: string[] = [];

    for (const surface of listSurfaces) {
      // Đo ở 360px — bề rộng mà bản cũ chuyển sang danh sách thẻ rút gọn.
      await page.setViewportSize({ width: 360, height: 900 });
      await goToSurface(page, surface.path);

      const headers = await page.evaluate(() =>
        [...document.querySelectorAll('[data-slot="data-table"] thead th')].map(
          (th) => (th.textContent ?? "").trim(),
        ),
      );

      for (const column of surface.mustHave) {
        if (!headers.includes(column)) {
          problems.push(
            `${surface.path} @360px: mất cột "${column}" (còn: ${headers.join(", ")})`,
          );
        }
      }
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });

  /**
   * Cột định danh dính phải có nền **ĐẶC**.
   *
   * Lỗi này lọt qua E2E **hai lần** và chỉ lộ khi nhìn ảnh chụp: nền
   * `bg-muted/40` trong suốt khiến chữ của các cột phía sau **trôi qua bên dưới**
   * ô dính khi cuộn ngang — hàng tiêu đề đọc ra **"Mãên hệ"** vì "Mã" và
   * "Liên hệ" chồng lên nhau. Bài kiểm này đo `alpha` của màu nền đã tính, nên
   * bắt được thứ mà "trang không tràn, axe xanh" không bao giờ thấy.
   */
  test("ô dính có nền đặc, chữ cột sau không trôi qua bên dưới", async ({
    page,
  }) => {
    const problems: string[] = [];

    for (const path of ["/admin/students", "/admin/courses", "/admin/classes"]) {
      await page.setViewportSize({ width: 500, height: 800 });
      await goToSurface(page, path);

      // Cuộn ngang thật rồi mới đo — đúng trạng thái người dùng gặp.
      await page.evaluate(() => {
        for (const s of document.querySelectorAll(
          '[data-slot="data-table-scroller"]',
        )) {
          s.scrollLeft = 260;
        }
      });

      const translucent = await page.evaluate(() => {
        const out: string[] = [];
        const sticky = [
          ...document.querySelectorAll(
            '[data-slot="data-table-head"], [data-slot="data-table-cell"]',
          ),
        ].filter((el) => getComputedStyle(el).position === "sticky");

        for (const el of sticky) {
          const bg = getComputedStyle(el).backgroundColor;
          // `rgb(...)` = đặc. `rgba(...)`/`oklab(... / 0.x)` = còn alpha.
          const alpha = /\/\s*([\d.]+)\s*\)/.exec(bg) ?? /rgba\([^)]*,\s*([\d.]+)\)/.exec(bg);
          if (alpha && Number(alpha[1]) < 1) {
            out.push(`"${(el.textContent ?? "").trim().slice(0, 12)}" → ${bg}`);
          }
        }
        return out;
      });

      for (const t of translucent) problems.push(`${path}: ${t}`);
    }

    expect(problems, problems.join("\n")).toEqual([]);
  });

  /**
   * `D-12` — ngày phải là `dd/MM/yyyy`. `/admin/reports` từng in thẳng chuỗi ISO
   * của cột `date` ("2026-07-15") ra màn hình; không ai thấy vì seed **không có
   * hóa đơn nào** nên bảng luôn rỗng. Bài này tự dựng một hóa đơn rồi dọn.
   */
  test("ngày trong báo cáo học phí theo định dạng dd/MM/yyyy", async ({ page }) => {
    const studentId = sql(
      `select id from public.students order by student_code limit 1;`,
    );
    const marker = "HD-E2E-P18";

    // Bảng tên `tuition_invoices`, khóa hiển thị là `invoice_code` — đã đọc
    // `information_schema` chứ không đoán theo tên trong code.
    sql(`delete from public.tuition_invoices where invoice_code like '${marker}%';`);
    sql(`
      insert into public.tuition_invoices
        (invoice_code, student_id, class_id, issue_date, due_date, status, subtotal, discount, total)
      values
        ('${marker}-01', '${studentId}', '${CLASS_ID}', date '2026-07-15', date '2026-08-15', 'issued', 1000000, 0, 1000000);
    `);

    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await goToSurface(page, "/admin/reports");

      const row = page.getByRole("row", { name: new RegExp(marker) });
      await expect(row).toBeVisible();

      // Phải thấy 15/07/2026, và tuyệt đối KHÔNG được thấy chuỗi ISO thô.
      await expect(row).toContainText("15/07/2026");
      await expect(row).not.toContainText("2026-07-15");
    } finally {
      sql(`delete from public.tuition_invoices where invoice_code like '${marker}%';`);
    }
  });

  /**
   * `BUG_M16_01` — bài học từ hệ cũ: nút xuất file **bỏ qua bộ lọc đang chọn**
   * nên file luôn ra toàn kỳ. Màn này có export THẬT nên phải kiểm thật.
   */
  test("nút xuất file mang theo đúng bộ lọc đang chọn", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await goToSurface(page, "/admin/reports?from=2026-01-01&to=2026-12-31&status=issued");

    for (const format of ["CSV", "XLSX"]) {
      const href = await page
        .getByRole("link", { name: `Xuất ${format}` })
        .getAttribute("href");

      expect(href, `Xuất ${format} phải giữ from/to/status`).toContain("from=2026-01-01");
      expect(href).toContain("to=2026-12-31");
      expect(href).toContain("status=issued");
    }
  });
});
