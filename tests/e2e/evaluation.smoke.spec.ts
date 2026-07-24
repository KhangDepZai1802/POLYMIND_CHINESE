import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

const DB = "supabase_db_Polymind_Chinese";
const NOTE_INTERNAL = "Ghi chú nội bộ SMOKE — không được lộ cho học viên";
const NOTE_SHARED = "Ghi chú chia sẻ SMOKE — học viên đọc được";
const COMMENT = "Nhận xét SMOKE";

function sql(query: string): string {
  return execFileSync(
    "docker",
    ["exec", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-c", query],
    { encoding: "utf8" },
  ).trim();
}

function purge() {
  sql(`delete from notifications where resource_id in
       (select id from learning_evaluations where teacher_comment = '${COMMENT}')`);
  sql(`delete from learning_evaluations where teacher_comment = '${COMMENT}'`);
  sql(`delete from student_notes where body in ('${NOTE_INTERNAL}', '${NOTE_SHARED}')`);
}

test.beforeEach(purge);
test.afterAll(purge);

test("GV A viết ghi chú nội bộ + đánh giá, gửi cho học viên; không chạm hồ sơ lớp GV B", async ({
  page,
}) => {
  const enrollmentLop02 = sql(
    `select e.id from enrollments e join classes c on c.id = e.class_id
     where c.code = 'LOP-02' and e.status = 'active' limit 1`,
  );
  const enrollmentLop03 = sql(
    `select e.id from enrollments e join classes c on c.id = e.class_id
     where c.code = 'LOP-03' and e.status = 'active' limit 1`,
  );
  const gvaUserId = sql("select id from auth.users where email = 'gv.a@polymind.test'");

  await page.goto("/login");
  await page.fill('input[name="identifier"]', "gv.a@polymind.test");
  await page.fill('input[name="password"]', "Polymind@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher");

  await page.goto(`/teacher/evaluations/${enrollmentLop02}`);

  // --- Ghi chú NỘI BỘ (mặc định staff_only) ----------------------------------
  await page.getByLabel("Nội dung ghi chú").fill(NOTE_INTERNAL);
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();
  await expect(page.getByText(NOTE_INTERNAL)).toBeVisible();
  await expect(page.getByText("Học viên không đọc được ghi chú này.")).toBeVisible();

  // DB: đúng phạm vi staff_only và created_by là actor thật (không phải client khai).
  expect(
    sql(`select visibility || '|' || (created_by = '${gvaUserId}')
         from student_notes where body = '${NOTE_INTERNAL}'`),
  ).toBe("staff_only|true");

  // --- Ghi chú CHIA SẺ -------------------------------------------------------
  await page.getByLabel("Nội dung ghi chú").fill(NOTE_SHARED);
  await page.getByLabel("Ai đọc được?").click();
  await page.getByRole("option", { name: "Học viên xem được" }).click();
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();
  await expect(page.getByText("Học viên đọc được ghi chú này.")).toBeVisible();

  expect(
    sql(`select visibility from student_notes where body = '${NOTE_SHARED}'`),
  ).toBe("student_visible");

  // --- Đánh giá: nháp → gửi --------------------------------------------------
  await page.getByRole("button", { name: "Viết đánh giá" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nhận xét chung").fill(COMMENT);
  await dialog.getByRole("button", { name: "Lưu bản nháp" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("Nháp — chưa gửi")).toBeVisible();

  const evalId = sql(
    `select id from learning_evaluations where teacher_comment = '${COMMENT}'`,
  );
  // Nháp: học viên KHÔNG thấy — cả hai cột hiển thị đều tắt.
  expect(
    sql(`select (published_at is null) || '|' || (not visible_to_student) || '|' ||
                (created_by = '${gvaUserId}')
         from learning_evaluations where id = '${evalId}'`),
  ).toBe("true|true|true");
  expect(sql(`select count(*) from notifications where resource_id = '${evalId}'`)).toBe("0");

  /*
   * Gửi đánh giá đi qua HAI bước, không phải một.
   *
   * Bài kiểm cũ dùng `page.once("dialog", d => d.accept())` — cách đó chỉ bắt
   * được `window.confirm` GỐC của trình duyệt. Ứng dụng đã chuyển sang
   * `ConfirmationProvider` (AlertDialog của Radix) từ lâu, nên dòng đó không bắt
   * gì cả: hộp xác nhận mở ra, không ai bấm, và `publish_evaluation` KHÔNG bao
   * giờ chạy. Bài kiểm đỏ ở đây là do mô hình hoá sai cơ chế xác nhận, không
   * phải do sản phẩm sai — đã kiểm chứng bằng cách chạy lại trên code trước
   * `P17-T3` và thấy đỏ y hệt.
   *
   * Bấm đúng như người dùng thật: mở hộp xác nhận rồi xác nhận.
   */
  await page
    .getByRole("button", { name: "Gửi cho học viên bản đánh giá" })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Gửi cho học viên", exact: true })
    .click();
  await expect(page.getByText("Học viên đã thấy")).toBeVisible();

  // Gửi = bật CẢ HAI cột cùng lúc + đúng 1 thông báo.
  expect(
    sql(`select (published_at is not null) || '|' || visible_to_student
         from learning_evaluations where id = '${evalId}'`),
  ).toBe("true|true");
  expect(sql(`select count(*) from notifications where resource_id = '${evalId}'`)).toBe("1");

  // --- IDOR: hồ sơ học viên lớp GV B ----------------------------------------
  await page.goto(`/teacher/evaluations/${enrollmentLop03}`);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  // URL rác không được 500 (lộ stack) — phải là 404.
  await page.goto("/teacher/evaluations/khong-phai-uuid");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  purge();
});
