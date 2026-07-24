import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * `P17-T3` / UIUX-M18 — màn Đánh giá & Ghi chú của giáo viên.
 *
 * Cùng tinh thần M16/M17 (`DS-031`): đây là công cụ làm việc hằng ngày, không
 * áp Learning Journey Bento. Bài kiểm nhắm vào roster lớp, hồ sơ đánh giá và
 * form ghi chú.
 *
 * Ba điểm đặc thù của M18 so với M16/M17:
 *  - Đây là màn giáo viên DUY NHẤT có hai mức hiển thị với học viên
 *    (`staff_only` vs `student_visible`, nháp vs đã gửi), nên nhầm một nhãn là
 *    lộ ghi chú nội bộ. Có bài kiểm riêng cho chuyện đó.
 *  - Một hồ sơ có NHIỀU đánh giá, mỗi bản một cụm nút icon giống hệt nhau →
 *    tên gọi được của nút phải phân biệt được từng bản.
 *  - Sửa một đánh giá ĐÃ GỬI thì học viên thấy ngay, khác hẳn sửa bản nháp.
 */

const DB = "supabase_db_Polymind_Chinese";
const TEACHER_USER_ID = "22222222-2222-2222-2222-222222222221";
/*
 * Tra ghi danh qua mỏ neo ổn định (auth user hv1 + mã lớp), không ghim UUID:
 * `enrollments.id` sinh mới sau mỗi `db reset` (`P17-T5`).
 */
const ENROLLMENT_ID = sql(`
  select e.id from public.enrollments e
  join public.classes c on c.id = e.class_id
  join public.students s on s.id = e.student_id
  where c.code = 'LOP-02' and s.user_id = '33333333-3333-3333-3333-333333333331'
    and e.status not in ('withdrawn', 'transferred')
  limit 1;`);

const DRAFT_EVAL_ID = "e1800000-0000-4000-8000-000000000001";
const PUBLISHED_EVAL_ID = "e1800000-0000-4000-8000-000000000002";
const INTERNAL_NOTE_ID = "e1800000-0000-4000-8000-000000000011";
const SHARED_NOTE_ID = "e1800000-0000-4000-8000-000000000012";

/** Hai ngày đánh giá khác nhau → tên nút icon của hai bản phải khác nhau. */
const DRAFT_DATE = "2026-07-10";
const DRAFT_DATE_VN = "10/07/2026";
const PUBLISHED_DATE = "2026-06-05";
const PUBLISHED_DATE_VN = "05/06/2026";

const WIDTH_LADDER = [360, 390, 430, 768, 1024, 1280] as const;

const CREATED_NOTE_BODY = "Ghi chú tạo bằng E2E UIUX M18";

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

function purgeFixture() {
  sql(`
    set session_replication_role = replica;
    delete from public.student_notes
      where id in ('${INTERNAL_NOTE_ID}', '${SHARED_NOTE_ID}')
         or body = '${CREATED_NOTE_BODY}';
    delete from public.learning_evaluations
      where id in ('${DRAFT_EVAL_ID}', '${PUBLISHED_EVAL_ID}');
    set session_replication_role = origin;
  `);
}

function setupFixture() {
  purgeFixture();
  sql(`
    begin;
    insert into public.learning_evaluations (
      id, enrollment_id, evaluation_date, period_start, period_end,
      overall_rating, listening_rating, speaking_rating,
      strengths, areas_for_improvement, action_plan, teacher_comment,
      visible_to_student, published_at, created_by
    ) values (
      '${DRAFT_EVAL_ID}', '${ENROLLMENT_ID}', date '${DRAFT_DATE}',
      date '2026-07-01', date '2026-07-31',
      'good', 'average', 'good',
      'Phát âm thanh 3 đã chắc.', 'Còn nhầm lượng từ 个 và 位.',
      'Mỗi buổi luyện 10 câu có lượng từ.', 'Tiến bộ đều, giữ nhịp này.',
      false, null, '${TEACHER_USER_ID}'
    );
    insert into public.learning_evaluations (
      id, enrollment_id, evaluation_date, period_start, period_end,
      overall_rating, reading_rating, writing_rating,
      strengths, teacher_comment,
      visible_to_student, published_at, created_by
    ) values (
      '${PUBLISHED_EVAL_ID}', '${ENROLLMENT_ID}', date '${PUBLISHED_DATE}',
      date '2026-05-01', date '2026-05-31',
      'excellent', 'excellent', 'good',
      'Đọc hiểu vượt yêu cầu HSK 2.', 'Kết quả kỳ này rất tốt.',
      true, timestamptz '2026-06-06 02:15:00+00', '${TEACHER_USER_ID}'
    );

    insert into public.student_notes (id, enrollment_id, body, visibility, created_by)
    values
      ('${INTERNAL_NOTE_ID}', '${ENROLLMENT_ID}',
       'Trao đổi với phụ huynh về việc đi học muộn.', 'staff_only', '${TEACHER_USER_ID}'),
      ('${SHARED_NOTE_ID}', '${ENROLLMENT_ID}',
       'Em nhớ mang vở bài tập buổi sau nhé.', 'student_visible', '${TEACHER_USER_ID}');
    commit;
  `);
}

async function loginTeacher(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("gv.a@polymind.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Polymind@2026");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/teacher");
}

async function expectAccessibleAndContained(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label}: tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, label).toEqual([]);
}

const PROFILE_PATH = `/teacher/evaluations/${ENROLLMENT_ID}`;

const SURFACES = [
  {
    name: "danh-sach",
    path: "/teacher/evaluations",
    h1: "Đánh giá & Ghi chú",
  },
  { name: "ho-so", path: PROFILE_PATH, h1: null },
] as const;

test.beforeAll(setupFixture);
test.afterAll(purgeFixture);

test("Hai màn Đánh giá & Ghi chú sạch axe và không tràn ngang", async ({
  page,
}) => {
  await loginTeacher(page);

  for (const surface of SURFACES) {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });

      if (surface.h1) {
        await expect(
          page.getByRole("heading", { name: surface.h1, level: 1 }),
        ).toBeVisible();
      }

      await expectAccessibleAndContained(page, `${surface.name}@${width}`);

      if (process.env.UIUX_CAPTURE === "1") {
        await page.screenshot({
          path: `C:/tmp/polymind-m18-${surface.name}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
});

test("Hai màn Đánh giá & Ghi chú không tràn ngang ở cả sáu bề rộng", async ({
  page,
}) => {
  await loginTeacher(page);

  for (const surface of SURFACES) {
    for (const width of WIDTH_LADDER) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(surface.path, { waitUntil: "domcontentloaded" });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(
        overflow,
        `${surface.name} @ ${width}px tràn ngang ${overflow}px`,
      ).toBeLessThanOrEqual(1);
    }
  }
});

test("Dòng thông tin học viên trong roster không dùng cỡ chữ 12px", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teacher/evaluations", { waitUntil: "domcontentloaded" });

  /*
   * Mã học viên, trạng thái ghi danh và số đánh giá là thông tin nghiệp vụ giáo
   * viên phải đọc được, không phải chú thích trang trí. Các module trước đã gỡ
   * hết `text-xs` khỏi loại thông tin này (M25/M26/M27); M18 là chỗ còn sót.
   */
  const meta = page.locator("li", { hasText: "HV" }).first().locator("p").nth(1);
  const fontSize = await meta.evaluate(
    (el) => Number.parseFloat(getComputedStyle(el).fontSize),
  );
  expect(fontSize, "dòng meta của học viên phải ≥ 14px").toBeGreaterThanOrEqual(
    14,
  );
});

test("Mỗi bản đánh giá là một heading thật và nút icon nói rõ bản nào", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PROFILE_PATH, { waitUntil: "domcontentloaded" });

  /*
   * `CardTitle` mặc định render `<div>`. Hồ sơ có nhiều bản đánh giá xếp dọc,
   * nếu không có heading thật thì người dùng trình đọc màn hình không nhảy được
   * giữa các bản — phải cuộn tuần tự qua toàn bộ nội dung.
   */
  await expect(
    page.getByRole("heading", { name: `Đánh giá ${DRAFT_DATE_VN}`, level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: `Đánh giá ${PUBLISHED_DATE_VN}`,
      level: 3,
    }),
  ).toBeVisible();

  /*
   * Trước `P17-T3` mọi bản đánh giá đều có nút `aria-label="Sửa đánh giá"` y
   * hệt nhau. Trình đọc màn hình đọc ra hai nút trùng tên, không cách nào biết
   * nút nào sửa bản nào.
   */
  await expect(
    page.getByRole("button", { name: `Sửa đánh giá ${DRAFT_DATE_VN}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Sửa đánh giá ${PUBLISHED_DATE_VN}` }),
  ).toBeVisible();
  /*
   * `exact: true` là bắt buộc ở đây: mặc định `getByRole(name)` khớp CHUỖI CON,
   * nên "Sửa đánh giá" vẫn khớp "Sửa đánh giá 10/07/2026" và phép đếm không nói
   * lên điều gì. Cái cần khoá là: không còn nút nào mang tên trống nghĩa, tức
   * tên đúng bằng "Sửa đánh giá" và không kèm bản nào.
   */
  await expect(
    page.getByRole("button", { name: "Sửa đánh giá", exact: true }),
  ).toHaveCount(0);
});

test("Bản đã gửi cảnh báo sửa là học viên thấy ngay; bản nháp thì không", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PROFILE_PATH, { waitUntil: "domcontentloaded" });

  /*
   * `publish_evaluation` bật `visible_to_student` = true. Sau đó
   * `updateEvaluationAction` vẫn cho sửa nội dung và KHÔNG hạ cờ đó xuống —
   * nghĩa là học viên đọc được bản sửa ngay lập tức.
   *
   * Nhưng dialog lại nói nguyên văn "Lưu form không gửi cho học viên." Câu đó
   * đúng với bản nháp và SAI với bản đã gửi. Đây là lỗi nội dung, không phải
   * lỗi hành vi: bài kiểm khoá đúng câu chữ, không đổi luật nghiệp vụ.
   */
  await page
    .getByRole("button", { name: `Sửa đánh giá ${PUBLISHED_DATE_VN}` })
    .click();
  const publishedDialog = page.getByRole("dialog", { name: "Sửa đánh giá" });
  await expect(publishedDialog).toBeVisible();
  await expect(publishedDialog).toContainText("học viên thấy thay đổi ngay");
  await expect(publishedDialog).not.toContainText(
    "Lưu form không gửi cho học viên",
  );
  await page.keyboard.press("Escape");
  await expect(publishedDialog).toBeHidden();

  await page
    .getByRole("button", { name: `Sửa đánh giá ${DRAFT_DATE_VN}` })
    .click();
  const draftDialog = page.getByRole("dialog", { name: "Sửa đánh giá" });
  await expect(draftDialog).toBeVisible();
  await expect(draftDialog).toContainText("Lưu form không gửi cho học viên");
});

test("Lỗi form ghi chú được trình đọc màn hình đọc ra và trỏ đúng ô nhập", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PROFILE_PATH, { waitUntil: "domcontentloaded" });

  const body = page.getByLabel("Nội dung ghi chú");
  // 2 ký tự — qua được `required` của trình duyệt, đụng `min(3)` của Zod ở server.
  await body.fill("ab");
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();

  /*
   * Tiền lệ `UX-UIUX-M27-*`: `FieldError` phải có `role="alert"` + `id`, và ô
   * nhập phải trỏ tới nó bằng `aria-describedby` kèm `aria-invalid` — CHỈ khi
   * thật sự có lỗi. M18 vẫn dùng bản cũ: `<p className="text-destructive text-xs">`
   * trần, trình đọc màn hình không hề biết form vừa lỗi.
   */
  const alert = page.getByRole("alert").filter({ hasText: "tối thiểu 3" });
  await expect(alert).toBeVisible();

  await expect(body).toHaveAttribute("aria-invalid", "true");

  /*
   * `aria-describedby` nhận NHIỀU id cách nhau bằng dấu cách: ô nhập phải giữ
   * cả câu gợi ý lẫn câu lỗi. Mất câu gợi ý đúng lúc có lỗi là mất chính thông
   * tin người dùng cần để sửa.
   */
  const describedBy = (await body.getAttribute("aria-describedby")) ?? "";
  const ids = describedBy.split(/\s+/).filter(Boolean);
  expect(ids.length, "ô nhập phải trỏ tới cả gợi ý và lỗi").toBeGreaterThan(1);

  const described = (
    await Promise.all(ids.map((one) => page.locator(`#${one}`).innerText()))
  ).join(" ");
  expect(described).toContain("tối thiểu 3");
  expect(described).toContain("Tối thiểu 3 ký tự");
});

test("Ghi chú nội bộ và ghi chú chia sẻ nói rõ ai đọc được", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PROFILE_PATH, { waitUntil: "domcontentloaded" });

  const internal = page
    .getByRole("listitem")
    .filter({ hasText: "Trao đổi với phụ huynh" });
  await expect(internal).toContainText("Học viên không đọc được");

  const shared = page
    .getByRole("listitem")
    .filter({ hasText: "Em nhớ mang vở bài tập" });
  await expect(shared).toContainText("Học viên đọc được");
});

test("Lưu một ghi chú THẬT rồi đọc DB xác nhận đúng phạm vi hiển thị", async ({
  page,
}) => {
  await loginTeacher(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PROFILE_PATH, { waitUntil: "domcontentloaded" });

  await page.getByLabel("Nội dung ghi chú").fill(CREATED_NOTE_BODY);
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();

  await expect(
    page.getByRole("listitem").filter({ hasText: CREATED_NOTE_BODY }),
  ).toBeVisible({ timeout: 20_000 });

  /*
   * Đọc thẳng DB: mặc định của form là `staff_only`. Ghi nhầm thành
   * `student_visible` nghĩa là ghi chú nội bộ lộ cho học viên — đúng loại lỗi
   * mà UI không bao giờ tự báo.
   */
  const visibility = sql(
    `select visibility from public.student_notes where body = '${CREATED_NOTE_BODY}';`,
  );
  expect(visibility, "ghi chú mặc định phải là nội bộ").toBe("staff_only");
});
