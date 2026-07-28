import { expect, test, type Page, type Request } from "@playwright/test";

/**
 * Đo thời gian chuyển module — đúng thứ user cảm thấy chậm.
 *
 * ⚠️ ĐÂY LÀ CÔNG CỤ ĐO, KHÔNG PHẢI BÀI KIỂM. Nó không assert ngưỡng tốc độ nào:
 * "chậm" không phải lỗi để CI đỏ, mà là con số để quyết định sửa chỗ nào. Thứ
 * duy nhất nó assert là "trang có lên thật không" — rơi vào error boundary thì
 * số đo vô nghĩa nên phải dừng và báo, không được lặng lẽ ghi ra một con số đẹp.
 *
 * Đo bằng **click vào sidebar**, KHÔNG `page.goto`. Hai thứ này khác hẳn nhau:
 * `goto` tải lại cả trang (dựng lại layout, tải lại JS), còn user thật thì bấm
 * link — App Router chỉ lấy đoạn RSC của segment mới. Cái user báo "4-5s" là
 * cái thứ hai.
 *
 * Danh sách màn đọc THẲNG TỪ SIDEBAR lúc chạy, không ghim cứng trong file này:
 * bản ghim cứng đầu tiên tôi viết đã lệch ngay với `navigation.ts` (khai 11 mục
 * cho giáo viên trong khi thật ra có 7). Đọc từ DOM thì không drift được, và tự
 * đúng cho cả ba role.
 *
 * Chạy:
 *   PERF_USER=... PERF_PASS=... npx playwright test --config=playwright.perf.config.ts
 *
 * Biến môi trường:
 *   PERF_BASE_URL  mặc định https://www.polymind.vn (đặt http://localhost:3000 để đo local)
 *   PERF_USER      tên đăng nhập
 *   PERF_PASS      mật khẩu
 *   PERF_ROUNDS    số vòng đo mỗi màn, mặc định 3 (lấy trung vị)
 */

/** `<h1>` của error boundary `(dashboard)/error.tsx` — xem `DS-018`. */
const ERROR_BOUNDARY_H1 = "Không tải được nội dung";

const NAV_TIMEOUT = 60_000;

const rounds = Number(process.env.PERF_ROUNDS ?? 3);
const baseURL = process.env.PERF_BASE_URL ?? "https://www.polymind.vn";

type Surface = { label: string; path: string };

/** Trung vị, KHÔNG phải trung bình: một lần cold start lệch làm hỏng trung bình. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

async function login(page: Page): Promise<void> {
  const user = process.env.PERF_USER;
  const pass = process.env.PERF_PASS;

  if (!user || !pass) {
    throw new Error(
      "Thiếu PERF_USER / PERF_PASS. Bộ đo cần một tài khoản THẬT để đo được " +
        "trang sau đăng nhập — không có đường vòng nào.",
    );
  }

  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(user);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  // Không ghim `/admin`: bộ đo phải chạy được với cả ba role, và role nào thì
  // server tự đưa về trang chủ của role đó.
  await page.waitForURL(/\/(admin|teacher|student)/, { timeout: NAV_TIMEOUT });
}

const sidebar = (page: Page) =>
  page.getByRole("navigation", { name: "Điều hướng chính" });

async function readSidebar(page: Page): Promise<Surface[]> {
  const links = sidebar(page).getByRole("link");
  await expect(links.first()).toBeVisible({ timeout: NAV_TIMEOUT });

  const surfaces: Surface[] = [];
  for (const link of await links.all()) {
    const path = await link.getAttribute("href");
    if (!path) continue;
    surfaces.push({ label: (await link.innerText()).trim(), path });
  }

  if (surfaces.length < 2) {
    throw new Error(
      `Sidebar chỉ có ${surfaces.length} mục — không đo được "chuyển module".`,
    );
  }
  return surfaces;
}

/**
 * Bấm link ở sidebar rồi chờ tới lúc **nhìn thấy nội dung thật**.
 *
 * Mốc dừng là **`<h1>` đổi sang tiêu đề của màn mới**, và tiêu đề đó không phải
 * error boundary (trang lỗi cũng có `<h1>` và về NHANH hơn trang thật, nên bỏ vế
 * này là tự thưởng cho mình một con số đẹp mà vô nghĩa).
 *
 * 🔴 **Bản đầu neo vào lớp phủ "Đang tải trang" và ĐO SAI — cộng thêm 460ms cố
 * định vào mọi số đo.** Nguyên nhân: có **HAI** phần tử `role="status"` mang
 * CÙNG `aria-label="Đang tải trang"` — [`page-loading-overlay.tsx`] (lớp phủ
 * thật) và [`nav-progress.tsx`] (thanh tiến trình mảnh ở đỉnh). Thanh tiến
 * trình chỉ trả `null` khi `!visible && progress === 0`, mà `done()` hẹn
 * `setVisible(false)` ở +220ms và `setProgress(0)` ở +460ms **SAU KHI** trang
 * đã render xong. Triệu chứng nhận ra: cả 12 màn ra gần y hệt nhau (1360–1400ms)
 * bất kể màn nặng hay nhẹ — dấu hiệu của một độ trễ CỐ ĐỊNH, không phải tải dữ
 * liệu. ⚠️ [`admin-responsive.spec.ts:143-146`] đang dùng đúng locator đó, nên
 * mỗi lượt điều hướng ở suite E2E cũng chờ thừa 460ms.
 */
async function measureNavigation(
  page: Page,
  surface: Surface,
): Promise<{ total: number; server: number | null }> {
  // TTFB của đúng request RSC cho segment này, tách phần "server + mạng" khỏi
  // phần "trình duyệt render".
  let serverMs: number | null = null;
  const onFinished = (request: Request) => {
    if (new URL(request.url()).pathname !== surface.path) return;
    const type = request.resourceType();
    if (type !== "fetch" && type !== "document") return;
    const timing = request.timing();
    if (timing.responseStart > 0) {
      serverMs = timing.responseStart - timing.requestStart;
    }
  };
  page.on("requestfinished", onFinished);

  // Bấm link của chính trang đang mở thì App Router KHÔNG điều hướng, `<h1>`
  // không bao giờ đổi, và phép đo treo tới hết giờ. Fail sớm với lý do thật
  // thay vì để lộ ra dưới dạng `TimeoutError` ở tận `waitForFunction`.
  const here = new URL(page.url()).pathname;
  if (here === surface.path) {
    page.off("requestfinished", onFinished);
    throw new Error(
      `measureNavigation: đang đứng sẵn ở "${surface.path}" — không có gì để đo.`,
    );
  }

  const h1 = page.getByRole("heading", { level: 1 }).first();
  // Tiêu đề của màn ĐANG đứng, để biết khi nào nó đã bị thay bằng màn mới.
  const previousTitle = (await h1.innerText().catch(() => "")).trim();

  try {
    const started = Date.now();

    await sidebar(page).locator(`a[href="${surface.path}"]`).click();

    // Trong lúc tải, thân trang bị thay bằng `loading.tsx` (không có `<h1>`),
    // nên phải chờ CẢ HAI: có `<h1>` trở lại VÀ nội dung của nó đã khác trước.
    //
    // Dùng `waitForFunction` (nhịp `raf`, ~16ms) chứ KHÔNG `expect.poll`: poll
    // mặc định giãn dần 100 → 250 → 500 → 1000ms, tức có thể cộng oan tới nửa
    // giây vào một phép đo chỉ tầm 1 giây. Đo sai theo hướng "chậm hơn thực tế"
    // đúng là cách phép đo trước đã lừa chính nó.
    await page.waitForFunction(
      (prev) => {
        const node =
          document.querySelector("h1") ??
          document.querySelector('[role="heading"][aria-level="1"]');
        const text = node?.textContent?.trim() ?? "";
        return text !== "" && text !== prev;
      },
      previousTitle,
      { timeout: NAV_TIMEOUT, polling: "raf" },
    );

    const total = Date.now() - started;

    expect(
      (await h1.innerText()).trim(),
      `${surface.path}: rơi vào error boundary — số đo không dùng được`,
    ).not.toBe(ERROR_BOUNDARY_H1);

    return { total, server: serverMs };
  } finally {
    page.off("requestfinished", onFinished);
  }
}

test("đo thời gian chuyển module", async ({ page }) => {
  await login(page);
  const surfaces = await readSidebar(page);

  const results = surfaces.map((surface) => ({
    surface,
    totals: [] as number[],
    servers: [] as number[],
  }));

  for (let round = 1; round <= rounds; round++) {
    for (const entry of results) {
      // Mỗi lượt đo cần một bước "lấy đà" từ màn khác, vì bấm link của trang
      // đang mở thì App Router không điều hướng.
      //
      // 🔴 Chọn màn lấy đà theo CHỈ SỐ (`surfaces[0]`) là sai, và đã làm treo
      // lượt chạy trước: đo xong `/admin` thì trang đang đứng ở `/admin`, mà
      // màn tiếp theo lại lấy đà từ đúng `/admin` đó. Phải chọn theo URL THẬT
      // đang mở — màn nào khác cả nơi đang đứng lẫn nơi sắp đo.
      const here = new URL(page.url()).pathname;
      const from = surfaces.find(
        (s) => s.path !== here && s.path !== entry.surface.path,
      );
      if (!from) {
        throw new Error(
          `Không tìm được màn lấy đà cho "${entry.surface.path}" (đang ở "${here}").`,
        );
      }
      await measureNavigation(page, from);

      const { total, server } = await measureNavigation(page, entry.surface);
      entry.totals.push(total);
      if (server !== null) entry.servers.push(server);

      console.log(
        `  vòng ${round} · ${entry.surface.path} → ${total}ms` +
          (server !== null ? ` (server ${Math.round(server)}ms)` : ""),
      );
    }
  }

  const rows = results.map((entry) => ({
    "Màn hình": entry.surface.label,
    Route: entry.surface.path,
    "Tổng (trung vị)": `${Math.round(median(entry.totals))}ms`,
    "Server (trung vị)": entry.servers.length
      ? `${Math.round(median(entry.servers))}ms`
      : "—",
    "Chậm nhất": `${Math.max(...entry.totals)}ms`,
  }));

  console.log(`\n=== ĐO CHUYỂN MODULE ===`);
  console.log(`Đích đo : ${baseURL}`);
  console.log(`Số vòng : ${rounds}`);
  console.log(`Số màn  : ${surfaces.length}\n`);
  console.table(rows);
  console.log(
    `\nTRUNG VỊ TOÀN BỘ: ${Math.round(median(results.flatMap((e) => e.totals)))}ms\n`,
  );
});
