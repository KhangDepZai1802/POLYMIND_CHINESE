import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const TITLE = "Bài tập SMOKE nộp bài";
const TITLE_OTHER = "Bài tập SMOKE lớp khác";
const ANSWER = "Đây là bài làm của học viên 1 — nộp qua trình duyệt thật.";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function purge() {
  const scope = `(select id from assignments where title in ('${TITLE}', '${TITLE_OTHER}'))`;
  sql(`delete from submission_files where submission_id in
       (select id from submissions where assignment_id in ${scope})`);
  sql(`delete from notifications where resource_id in
       (select id from submissions where assignment_id in ${scope})`);
  sql(`delete from submissions where assignment_id in ${scope}`);
  sql(`delete from notifications where resource_id in ${scope}`);
  // Trigger `prevent_assignment_history_delete` cấm xóa bài ĐÃ GIAO — đúng thiết kế
  // sản phẩm (giữ lịch sử). Dọn fixture thì phải hạ về draft sau khi đã xóa bài nộp.
  sql(`update assignments set status = 'draft', published_at = null
       where title in ('${TITLE}', '${TITLE_OTHER}')`);
  sql(`delete from assignments where title in ('${TITLE}', '${TITLE_OTHER}')`);
}

/** Tạo bài tập ĐÃ GIAO. Trigger ép INSERT về draft → phải publish bằng UPDATE. */
function publishedAssignment(classCode: string, title: string): string {
  const id = sql(
    `insert into assignments (class_id, title, max_score, created_by, allow_late_submission)
     values ((select id from classes where code = '${classCode}'), '${title}', 100,
             (select id from auth.users where email = 'gv.a@polymind.test'), true)
     returning id`,
  );
  sql(
    `update assignments set status = 'published', published_at = now() where id = '${id}'`,
  );
  return id;
}

test.beforeEach(purge);
test.afterAll(purge);

test("HV1 nộp bài text + file, nhận điểm; không xem được bài lớp khác", async ({
  page,
}) => {
  const assignmentId = publishedAssignment("LOP-02", TITLE);
  const otherId = publishedAssignment("LOP-03", TITLE_OTHER);
  const hv1Enrollment = sql(
    `select e.id from enrollments e
     join students s on s.id = e.student_id
     join auth.users u on u.id = s.user_id
     where u.email = 'hv1@polymind.test' and e.status = 'active'`,
  );

  // --- Đăng nhập học viên ----------------------------------------------------
  await page.goto("/login");
  await page.fill('input[name="email"]', "hv1@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student");

  // Dashboard đếm đúng bài chưa nộp.
  await expect(page.getByText(TITLE).first()).toBeVisible();

  // --- Nộp bài dạng text -----------------------------------------------------
  await page.goto(`/student/assignments/${assignmentId}`);
  await expect(page.getByText("Chưa nộp")).toBeVisible();

  await page.getByLabel("Câu trả lời").fill(ANSWER);
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText("Đã nộp", { exact: true })).toBeVisible();

  // DB: đúng enrollment của HV1, thời điểm nộp do DB đặt, KHÔNG có điểm tự khai.
  const row = sql(
    `select (enrollment_id = '${hv1Enrollment}') || '|' || status || '|' ||
            (submitted_at is not null) || '|' || coalesce(score::text, 'NULL')
     from submissions where assignment_id = '${assignmentId}'`,
  );
  expect(row).toBe("true|submitted|true|NULL");

  const submissionId = sql(
    `select id from submissions where assignment_id = '${assignmentId}'`,
  );

  // --- Đính kèm file ---------------------------------------------------------
  const dir = mkdtempSync(join(tmpdir(), "polymind-"));
  const filePath = join(dir, "bai-lam.txt");
  writeFileSync(filePath, "Nội dung bài làm tiếng Việt có dấu.", "utf8");

  await page.setInputFiles('input[type="file"]', filePath);
  await page.getByRole("button", { name: "Đính kèm" }).click();
  await expect(page.getByText("bai-lam.txt")).toBeVisible();

  // Path phải đúng `{class_id}/{submission_id}/…` — trigger ở DB là chốt cuối.
  const classId = sql("select id from classes where code = 'LOP-02'");
  const objectPath = sql(
    `select object_path from submission_files where submission_id = '${submissionId}'`,
  );
  expect(objectPath.startsWith(`${classId}/${submissionId}/`)).toBe(true);

  // --- Giáo viên chấm bài (RPC, bằng JWT thật của GV A) ----------------------
  const gvaId = sql("select id from auth.users where email = 'gv.a@polymind.test'");
  sql(
    `select set_config('request.jwt.claims',
       json_build_object('sub', '${gvaId}', 'role', 'authenticated')::text, false);
     set role authenticated;
     select public.grade_submission('${submissionId}', 88.5, 'Bài tốt, cần luyện thêm.');
     reset role;`,
  );

  // --- Học viên thấy điểm, và bài bị KHÓA sửa -------------------------------
  await page.reload();
  await expect(page.getByText("Bài đã được chấm")).toBeVisible();
  await expect(page.getByText("88,5")).toBeVisible();
  await expect(page.getByText("Bài tốt, cần luyện thêm.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Cập nhật bài làm/ }),
  ).toHaveCount(0);

  // --- Negative: bài tập của lớp khác ---------------------------------------
  const response = await page.goto(`/student/assignments/${otherId}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText(TITLE_OTHER)).toHaveCount(0);

  const garbage = await page.goto("/student/assignments/khong-phai-uuid");
  expect(garbage?.status()).toBe(404);

  // --- Negative: không thấy dữ liệu học viên khác ---------------------------
  await page.goto("/student/assignments");
  await expect(page.getByText(TITLE_OTHER)).toHaveCount(0);
  await expect(page.getByText("HV002")).toHaveCount(0);

  purge();
});
