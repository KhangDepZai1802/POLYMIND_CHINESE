import { execFileSync } from "node:child_process";

import { expect, test, type Locator, type Page } from "@playwright/test";

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
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
}

/**
 * Đặt một mốc thời gian trên `DateTimePicker` (nút mở popover chứa lịch + ô giờ).
 *
 * Không dùng `fill()` được vì trigger là `<button>`, giá trị thật nằm ở
 * `<input type="hidden">` do component tự dựng từ ngày đã chọn + giờ đã nhập.
 */
async function pickTodayAt(
  page: Page,
  scope: Locator,
  label: string,
  time: string,
) {
  await scope.getByLabel(label, { exact: true }).click();
  // Popover render qua portal nên nằm NGOÀI dialog — phải tìm ở cấp `page`.
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  await grid.locator("[data-today]").first().click();
  await page.getByLabel("Giờ", { exact: true }).fill(time);
  await page.keyboard.press("Escape");
  await expect(grid).toBeHidden();
}

async function createAndLockSet(page: Page, route: string, title: string) {
  await page.goto(route);
  await page.getByLabel("Tên bộ").fill(title);
  await page.getByRole("button", { name: "Tạo bộ", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  /* `UX-UIUX-M00-020` (phần 2) — đoạn này cũng viết theo UI đã không còn.
   *
   * Bản cũ giả định một `<Select>` (combobox + option) rồi một ô "Điểm" và nút
   * "Thêm câu". `question-picker.tsx` hiện tại là một **dialog** mở bằng nút
   * "Thêm câu hỏi", bên trong có ô tìm kiếm, danh sách tick chọn, ô "Điểm mỗi
   * câu", và nút gửi ghi "Thêm N câu đã chọn". Vì bài test chết từ bước tạo câu
   * hỏi phía trên nên chỗ này chưa từng chạy để lộ ra.
   *
   * Tick theo `<label>` bọc quanh checkbox chứ không theo `getByRole` của
   * checkbox: Radix Checkbox render `<button role="checkbox">` không có tên
   * gọi được ở đây, còn nhãn bọc ngoài thì mang đúng tiêu đề câu hỏi. */
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();
  const picker = page.getByRole("dialog");
  await picker.getByPlaceholder("Tìm mã hoặc tiêu đề…").fill(QUESTION_TITLE);
  await picker
    .locator("label", { hasText: QUESTION_TITLE })
    .getByRole("checkbox")
    .check();
  await picker.getByLabel("Điểm mỗi câu").fill("10");
  await picker.getByRole("button", { name: /Thêm .* đã chọn/ }).click();
  await expect(picker).toBeHidden();
  // `raw_max_score` chỉ được tính khi KHÓA bộ, nên trước khi khóa vẫn là 0 điểm
  // — bản cũ đúng ở chỗ này, giữ nguyên ý, chỉ đổi chữ cho khớp UI hiện tại
  // ("điểm thô" → "điểm").
  await expect(page.getByText(/1 câu · 0 điểm/)).toBeVisible();

  await page
    .getByRole("button", { name: "Kiểm tra & khóa bộ (sẵn sàng giao)" })
    .click();
  await expect(page.getByText("Bộ đã khóa, sẵn sàng để giao.")).toBeVisible();
  await expect(page.getByText(/1 câu · 10 điểm/)).toBeVisible();
}

test.beforeEach(purge);
test.afterAll(purge);

test("giáo viên tạo câu hỏi rồi chốt được cả bộ bài tập và bộ đề thi", async ({ page }) => {
  await loginTeacher(page);
  await page.goto("/teacher/exercises/question-bank");
  await page.getByRole("button", { name: "Tạo câu hỏi" }).click();

  /* `UX-UIUX-M00-020` — viết lại đoạn này 2026-07-23.
   *
   * Bản cũ bấm "Tạo câu hỏi" rồi đòi ngay `getByLabel("Tiêu đề nội bộ")`, tức
   * viết theo FORM MỘT TRANG đã không còn. `question-wizard.tsx` là wizard
   * **4 bước**: (1) chọn kỹ năng → (2) chọn dạng câu → (3) nhập nội dung →
   * (4) xem trước rồi lưu. Ô "Tiêu đề nội bộ" chỉ render ở bước 3, nên bài test
   * hết giờ ngay dòng đầu và **mọi assertion phía sau — gồm cả hai câu đọc DB
   * dưới đây — chưa từng được thực thi lần nào**. `git status` xác nhận cả spec
   * lẫn wizard đều là code đã commit, tức hỏng từ trước chứ không phải hồi quy.
   *
   * Bản cũ còn sai thêm hai chỗ mà chỉ đọc kỹ mới thấy:
   *   - nút lưu nay ghi **"Lưu & công bố"**, không phải "Lưu & sẵn sàng";
   *   - lựa chọn nay là NHIỀU ô rời có placeholder "Lựa chọn 1/2" cộng một
   *     radio "Đáp án đúng N", không phải một textarea ngăn bằng xuống dòng và
   *     một ô "Đáp án chấm".
   *
   * Trạng thái `ready` mà câu SQL dưới kiểm là ĐÚNG, đã đọc lại đường ghi để
   * chắc chứ không đoán: RPC `create_question_version` đặt `status='draft'`,
   * rồi bước 4 của `saveQuestionAction` gọi `publish_question_version` —
   * chính RPC đó mới `update questions set status='ready'`. Nghĩa là câu SQL
   * này kiểm được cả việc bước công bố có chạy hay không. */
  const dialog = page.getByRole("dialog");

  // Bước 1 → 2: bấm thẻ kỹ năng (tự sang bước kế, không có nút "Tiếp tục").
  await dialog.getByRole("button", { name: /^Đọc/ }).click();
  // Bước 2 → 3: chọn dạng câu. "Đọc" mở single_choice ở đầu danh sách.
  await dialog
    .getByRole("button", { name: "Trắc nghiệm một đáp án" })
    .click();

  // Bước 3 — nội dung.
  await dialog.getByLabel("Tiêu đề nội bộ").fill(QUESTION_TITLE);
  await dialog.getByLabel("Nội dung câu hỏi").fill("你好 nghĩa là gì?");
  await dialog.getByPlaceholder("Lựa chọn 1").fill("Xin chào");
  await dialog.getByPlaceholder("Lựa chọn 2").fill("Tạm biệt");
  await dialog.getByLabel("Đáp án đúng 1").check();

  // Bước 3 → 4 (xem trước) → lưu.
  await dialog.getByRole("button", { name: "Tiếp tục" }).click();
  await dialog.getByRole("button", { name: "Lưu & công bố" }).click();
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
  /* `UX-UIUX-M00-020` (phần 3) — nửa lên lịch thi cũng viết theo UI đã đổi.
   *
   * Hai chỗ lệch, đều là thay đổi CÓ CHỦ ĐÍCH của M17 chứ không phải hỏng:
   *   - "Lớp" nay là **nhóm checkbox trong `<fieldset>`** (`DS-003` cấm đổi
   *     `<input type="checkbox">` của `class_ids` vì gửi nhiều giá trị cùng tên
   *     là hành vi nghiệp vụ "giao một lúc cho nhiều lớp"), không phải `<Select>`
   *     nên không có `role="option"` nào để bấm.
   *   - "Mở lúc"/"Đóng lúc" nay là `DateTimePicker` — một **nút mở popover**
   *     chứa lịch + ô giờ, ghi giá trị vào `<input type="hidden">`. `fill()`
   *     không dùng được trên nút. */
  await examDialog
    .getByRole("checkbox", { name: /LOP-02/ })
    .check();
  await examDialog.getByLabel("Tiêu đề").fill(EXAM_TITLE);
  // Cả hai mốc đều là HÔM NAY nên chỉ cần bấm ô ngày hôm nay rồi đặt giờ.
  await pickTodayAt(page, examDialog, "Mở lúc", "00:05");
  await pickTodayAt(page, examDialog, "Đóng lúc", "23:55");
  await examDialog.getByLabel("Thời lượng (phút)").fill("30");
  await examDialog.getByRole("button", { name: "Lên lịch" }).click();
  await expect(examDialog).toBeHidden();

  // Kiểm DB TRƯỚC khi kiểm giao diện: đây mới là nguồn sự thật. Nếu hàng đã có
  // mà màn hình chưa hiện thì đó là chuyện hiển thị, không phải chuyện lưu.
  const deliveryId = sql(`select id from exam_deliveries where title='${EXAM_TITLE}'`);
  expect(deliveryId, "kỳ thi phải được lưu vào DB").toMatch(/^[0-9a-f-]{36}$/);
  // `exact: true`: tiêu đề xuất hiện HAI lần trên trang — một ở thẻ kỳ thi, một
  // ở nhãn "Kỳ thi E2E engine:" của cụm nút thao tác. Khớp chuỗi con thì locator
  // trúng cả hai và hỏng ở strict mode, đúng bài học `UX-UIUX-M18`.
  await expect(page.getByText(EXAM_TITLE, { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.b@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
  await page.goto(`/teacher/exams/${deliveryId}`);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("hv1@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
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
