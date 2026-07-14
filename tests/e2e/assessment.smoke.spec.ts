import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const TITLE = "Kiểm tra giữa kỳ SMOKE";
const TITLE_OUTSIDE = "Bài KT LOP-03 SMOKE";

/**
 * `-q` là bắt buộc: không có nó, psql in kèm command tag ("INSERT 0 1") vào stdout
 * và giá trị RETURNING bị dính đuôi → UUID rác đi thẳng vào URL/test.
 */
function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

/** Dọn dữ liệu smoke của lần chạy trước để test chạy lại được từ trạng thái sạch. */
function purgeSmokeData() {
  const scope = `(select id from assessments where title in ('${TITLE}', '${TITLE_OUTSIDE}'))`;
  sql(`delete from notifications where resource_id in ${scope}`);
  sql(`delete from assessment_results where assessment_id in ${scope}`);
  sql(`delete from assessments where title in ('${TITLE}', '${TITLE_OUTSIDE}')`);
}

test.beforeEach(purgeSmokeData);
test.afterAll(purgeSmokeData);

test("GV A tạo bài KT, nhập điểm 6 kỹ năng, công bố; không chạm được lớp GV B", async ({
  page,
}) => {
  const lop02 = sql("select id from classes where code = 'LOP-02'");
  const lop03 = sql("select id from classes where code = 'LOP-03'");
  const gvaUserId = sql("select id from auth.users where email = 'gv.a@polymind.test'");

  // Bài KT của LOP-03 (GV A KHÔNG dạy, kể cả trợ giảng) — dựng bằng SQL để test IDOR.
  const outsideId = sql(
    `insert into assessments (class_id, type, title, max_score, created_by)
     values ('${lop03}', 'quiz', '${TITLE_OUTSIDE}', 100,
             (select id from auth.users where email = 'gv.b@polymind.test'))
     returning id`,
  );

  // --- Đăng nhập GV A --------------------------------------------------------
  await page.goto("/login");
  await page.fill('input[name="email"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  // --- Tạo bài kiểm tra ------------------------------------------------------
  await page.goto(`/teacher/assessments?class=${lop02}`);
  await page.getByRole("button", { name: "Tạo bài kiểm tra" }).first().click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên bài kiểm tra *").fill(TITLE);
  await dialog.getByLabel("Ngày kiểm tra").fill("2026-07-20");
  await dialog.getByRole("button", { name: "Tạo bài kiểm tra" }).click();
  await expect(dialog).toBeHidden();

  const card = page.locator("div").filter({ hasText: TITLE }).last();
  await expect(page.getByText(TITLE).first()).toBeVisible();
  await expect(card.getByText("Chưa công bố").first()).toBeVisible();

  const assessmentId = sql(
    `select id from assessments where title = '${TITLE}' and class_id = '${lop02}'`,
  );
  expect(assessmentId).not.toBe("");

  // Bài KT sinh ra phải là NHÁP, và created_by là actor thật.
  expect(sql(`select published_at is null from assessments where id = '${assessmentId}'`)).toBe("t");
  expect(sql(`select created_by from assessments where id = '${assessmentId}'`)).toBe(gvaUserId);

  // --- Nhập điểm tổng + 6 kỹ năng -------------------------------------------
  await page.goto(`/teacher/assessments/${assessmentId}`);
  await expect(page.getByText("Đã chấm 0/2 học viên")).toBeVisible();

  // Chưa có điểm nào → không công bố được.
  await expect(page.getByRole("button", { name: /Công bố kết quả/ })).toBeDisabled();

  const first = page.locator("form").filter({ has: page.getByLabel("Nghe") }).first();
  for (const [label, value] of [
    ["Nghe", "90"],
    ["Nói", "80"],
    ["Đọc", "88"],
    ["Viết", "82"],
    ["Từ vựng", "86"],
    ["Ngữ pháp", "84"],
  ] as const) {
    await first.getByLabel(label, { exact: true }).fill(value);
  }

  await first.getByRole("button", { name: "Tính TB 6 kỹ năng" }).click();
  await expect(first.getByLabel(/^Tổng/)).toHaveValue("85");

  await first.getByRole("textbox").fill("Nghe tốt, cần luyện nói.");
  await first.getByRole("button", { name: /Lưu điểm/ }).click();
  await expect(page.getByText("Đã chấm 1/2 học viên")).toBeVisible();

  // DB: điểm đúng, actor thật, xếp loại do DB tính, và CHƯA công bố.
  const row = sql(
    `select overall_score || '|' || listening_score || '|' || classification || '|' ||
            (graded_by = '${gvaUserId}') || '|' || (published_at is null)
     from assessment_results where assessment_id = '${assessmentId}'`,
  );
  // Nối boolean với text trong psql in ra "true"/"false" (không phải "t"/"f").
  expect(row).toBe("85.00|90.00|Giỏi|true|true");

  // Học viên chưa được thông báo gì khi chưa công bố.
  expect(
    sql(`select count(*) from notifications where resource_id = '${assessmentId}'`),
  ).toBe("0");

  // --- Công bố ---------------------------------------------------------------
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Công bố kết quả/ }).click();
  await expect(page.getByText("Đã công bố 1")).toBeVisible();

  expect(sql(`select published_at is not null from assessments where id = '${assessmentId}'`)).toBe("t");
  expect(
    sql(`select count(*) from assessment_results
         where assessment_id = '${assessmentId}' and published_at is not null`),
  ).toBe("1");
  // Đúng 1 thông báo cho đúng 1 học viên đã có điểm (HV chưa chấm không bị báo).
  expect(
    sql(`select count(*) from notifications where resource_id = '${assessmentId}'`),
  ).toBe("1");

  // Không còn gì để công bố → nút tắt (không có đường bấm hai lần từ UI).
  await expect(page.getByRole("button", { name: /Công bố kết quả/ })).toBeDisabled();

  // --- IDOR: lớp GV A không dạy ---------------------------------------------
  const response = await page.goto(`/teacher/assessments/${outsideId}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText(TITLE_OUTSIDE)).toHaveCount(0);

  // Class picker của GV A không có LOP-03.
  await page.goto("/teacher/assessments");
  await expect(page.getByText("LOP-03")).toHaveCount(0);

  purgeSmokeData();
});
