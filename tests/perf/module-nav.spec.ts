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
 * Mốc dừng gồm hai vế, thiếu vế nào cũng ra số sai:
 *  1. lớp phủ "Đang tải trang" đã tắt — tức đoạn RSC của trang đã về;
 *  2. có `<h1>` và `<h1>` đó KHÔNG phải error boundary — tức trang lên thật.
 *     Trang lỗi cũng có `<h1>`, cũng làm overlay tắt, và nó về NHANH hơn trang
 *     thật, nên bỏ vế này là tự thưởng cho mình một con số đẹp mà vô nghĩa.
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

  try {
    const started = Date.now();

    await sidebar(page).locator(`a[href="${surface.path}"]`).click();

    await expect(
      page.getByRole("status", { name: "Đang tải trang" }),
      `${surface.path}: lớp phủ "Đang tải trang" chưa tắt sau ${NAV_TIMEOUT}ms`,
    ).toHaveCount(0, { timeout: NAV_TIMEOUT });

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(
      h1,
      `${surface.path}: chưa có <h1> nào — đoạn RSC của trang chưa về`,
    ).toBeVisible({ timeout: NAV_TIMEOUT });

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
      // Luôn xuất phát từ một màn KHÁC màn sắp đo: bấm link của trang đang đứng
      // thì App Router không điều hướng và ta đo ra ~0ms.
      const from =
        entry.surface.path === surfaces[0]!.path ? surfaces[1]! : surfaces[0]!;
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
