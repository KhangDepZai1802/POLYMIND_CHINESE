import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const QUESTION_TITLE = "Câu E2E assessment engine";
const EXERCISE_SET = "Bộ bài tập E2E engine";
const EXAM_SET = "Bộ đề thi E2E engine";
const EXAM_TITLE = "Kỳ thi E2E engine";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function purge() {
  sql(`set session_replication_role=replica; delete from exam_regrade_runs where exam_delivery_id in (select id from exam_deliveries where title='${EXAM_TITLE}'); delete from exam_answers where attempt_id in (select id from exam_attempts where exam_delivery_id in (select id from exam_deliveries where title='${EXAM_TITLE}')); delete from exam_integrity_events where attempt_id in (select id from exam_attempts where exam_delivery_id in (select id from exam_deliveries where title='${EXAM_TITLE}')); delete from exam_attempts where exam_delivery_id in (select id from exam_deliveries where title='${EXAM_TITLE}'); delete from exam_deliveries where title='${EXAM_TITLE}'; update question_sets set current_version_id = null where title in ('${EXERCISE_SET}', '${EXAM_SET}'); delete from question_sets where title in ('${EXERCISE_SET}', '${EXAM_SET}'); update questions set current_version_id = null where title = '${QUESTION_TITLE}'; delete from questions where title = '${QUESTION_TITLE}'; set session_replication_role=origin`);
}

async function loginTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.a@polymind.test");
  await page.getByLabel("Mật khẩu").fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
}

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function createAndLockSet(page: Page, route: string, title: string) {
  await page.goto(route);
  await page.getByLabel("Tên bộ").fill(title);
  await page.getByRole("button", { name: "Tạo bộ", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: new RegExp(QUESTION_TITLE) }).click();
  await page.getByLabel("Điểm").fill("10");
  await page.getByRole("button", { name: "Thêm câu" }).click();
  await expect(page.getByText("1 câu · 0 điểm thô")).toBeVisible();

  await page.getByRole("button", { name: "Kiểm tra & chốt version" }).click();
  await expect(page.getByText("Version đã khóa, sẵn sàng để giao.")).toBeVisible();
  await expect(page.getByText("1 câu · 10 điểm thô")).toBeVisible();
}

test.beforeEach(purge);
test.afterAll(purge);

test("giáo viên tạo câu hỏi rồi chốt được cả bộ bài tập và bộ đề thi", async ({ page }) => {
  await loginTeacher(page);
  await page.goto("/teacher/exercises/question-bank");
  await page.getByRole("button", { name: "Tạo câu hỏi" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tiêu đề nội bộ").fill(QUESTION_TITLE);
  await dialog.getByLabel("Nội dung câu hỏi").fill("你好 nghĩa là gì?");
  await dialog.getByLabel(/Lựa chọn \/ token/).fill("Xin chào\nTạm biệt");
  await dialog.getByLabel(/Đáp án chấm/).fill("1");
  await dialog.getByRole("button", { name: "Lưu & sẵn sàng" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(QUESTION_TITLE)).toBeVisible();

  expect(sql(`select count(*) from questions q join question_versions v on v.id=q.current_version_id where q.title='${QUESTION_TITLE}' and q.status='ready' and v.question_type='single_choice'`)).toBe("1");

  await createAndLockSet(page, "/teacher/exercises/sets", EXERCISE_SET);
  await createAndLockSet(page, "/teacher/exams/sets", EXAM_SET);

  expect(sql(`select count(*) from question_sets s join question_set_versions v on v.id=s.current_version_id where s.title in ('${EXERCISE_SET}', '${EXAM_SET}') and v.locked_at is not null`)).toBe("2");

  await page.goto("/teacher/exams");
  await page.getByRole("button", { name: "Tạo kỳ thi" }).click();
  const examDialog = page.getByRole("dialog");
  await examDialog.getByLabel("Bộ đề đã khóa").click();
  await page.getByRole("option", { name: new RegExp(EXAM_SET) }).click();
  await examDialog.getByLabel("Lớp").click();
  await page.getByRole("option", { name: /LOP-02/ }).click();
  await examDialog.getByLabel("Tiêu đề").fill(EXAM_TITLE);
  const now = new Date();
  const opens = new Date(now.getTime() - 5 * 60_000);
  const closes = new Date(now);
  closes.setHours(23, 55, 0, 0);
  await examDialog.getByLabel("Mở lúc").fill(localDateTime(opens));
  await examDialog.getByLabel("Đóng lúc").fill(localDateTime(closes));
  await examDialog.getByLabel("Thời lượng (phút)").fill("30");
  await examDialog.getByRole("button", { name: "Lên lịch" }).click();
  await expect(examDialog).toBeHidden();
  await expect(page.getByText(EXAM_TITLE)).toBeVisible();

  const deliveryId = sql(`select id from exam_deliveries where title='${EXAM_TITLE}'`);
  expect(deliveryId).toMatch(/^[0-9a-f-]{36}$/);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.b@polymind.test");
  await page.getByLabel("Mật khẩu").fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
  await page.goto(`/teacher/exams/${deliveryId}`);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu").fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/student");
  await page.goto("/student/exams");
  await expect(page.getByText(EXAM_TITLE)).toBeVisible();
  await page.getByRole("button", { name: "Vào phòng chờ" }).click();
  await page.getByRole("button", { name: "Phát âm thanh kiểm tra" }).click();
  await page.getByText(/Tôi hiểu bài thi không cho copy/).click();
  await page.getByRole("button", { name: "Bắt đầu thi" }).click();
  await page.waitForURL(new RegExp(`/student/exams/${deliveryId}/attempt/`));
  await expect(page.getByText("你好 nghĩa là gì?")).toBeVisible();
  expect(sql(`select count(*) from exam_attempts where exam_delivery_id='${deliveryId}' and status='in_progress'`)).toBe("1");
});
