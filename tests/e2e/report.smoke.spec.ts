import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

test("Báo cáo lớp chỉ hiện lớp GV A dạy, số liệu khớp DB", async ({ page }) => {
  const lop02 = sql("select id from classes where code = 'LOP-02'");
  const lop03 = sql("select id from classes where code = 'LOP-03'");

  // Sự thật trong DB, đọc bằng postgres (bỏ qua RLS) để so với cái UI hiển thị.
  const activeStudents = sql(
    `select count(*) from enrollments
     where class_id = '${lop02}' and status not in ('withdrawn','transferred')`,
  );

  await page.goto("/login");
  await page.fill('input[name="identifier"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  await page.goto(`/teacher/progress?class=${lop02}`);
  await expect(page.getByRole("heading", { name: "Báo cáo lớp" })).toBeVisible();

  // KPI "Học viên đang học" phải khớp đúng số enrollment đang mở trong DB.
  const kpi = page.locator("div").filter({ hasText: /^Học viên đang học/ }).last();
  await expect(kpi).toContainText(activeStudents);

  // Bảng chi tiết có đúng số dòng học viên.
  await expect(page.locator("tbody tr")).toHaveCount(Number(activeStudents));

  // --- Gate Phase 4: không thấy lớp GV B ------------------------------------
  await expect(page.getByText("LOP-03")).toHaveCount(0);

  // Gõ thẳng ?class=<LOP-03> cũng không mở được báo cáo lớp đó: RLS trả 0 dòng
  // nên trang rơi về lớp đầu tiên GV A thực sự dạy, không lộ dữ liệu LOP-03.
  await page.goto(`/teacher/progress?class=${lop03}`);
  await expect(page.getByText("LOP-03")).toHaveCount(0);

  const shownClassCode = await page
    .locator("span.font-mono")
    .first()
    .textContent();
  expect(shownClassCode).not.toContain("LOP-03");
});
