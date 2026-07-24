import { execFileSync } from "node:child_process";

/**
 * Dọn sạch **mọi** dải fixture E2E trước khi suite bắt đầu.
 *
 * Vì sao cần: mỗi spec chỉ xoá rác **của chính nó** (`beforeEach`/`afterAll` cục
 * bộ). Khi một lượt chạy bị dừng giữa chừng — Ctrl-C, máy hết RAM, Docker tắt —
 * rác của spec A nằm lại DB và **phá lượt chạy kế tiếp ở spec B**. Đúng thứ đã
 * xảy ra ở đợt 10: `student-exams-responsive` để lại 3 `exam_deliveries`, nên
 * `assessment-engine.smoke` (chạy ở bài 25, sớm hơn nhiều) thấy học viên `hv1`
 * có **2 kỳ thi sẵn sàng** và `getByRole('button', {name:'Vào phòng chờ'})` khớp
 * 2 phần tử. Không spec nào tự sửa được lớp lỗi này vì không spec nào biết về
 * fixture của spec khác — chỗ duy nhất biết đủ là đây.
 *
 * ⚠️ Chỉ xoá thứ **do E2E dựng ra**, không đụng seed:
 *   - dải UUID fixture `[ef]#######-0000-4000-8000-…` — `seed.sql`/`seed.dev.sql`
 *     có **0 hàng** mang hình dạng này (đã đếm), nên vét cả dải là an toàn;
 *   - các nhãn nghiệp vụ mà spec tự đặt (tiêu đề "… E2E …", `HD-E2E-P18…`).
 *
 * `DS-040`: không ghim UUID hàng seed — ở đây ngược lại, chỉ ghim UUID mà chính
 * spec **tự đặt**, đó là thứ ổn định qua mọi `db reset`.
 */

const DB = "supabase_db_Polymind_Chinese";

/** Vị ngữ nhận diện một UUID do fixture E2E tự đặt. */
const FX = (col: string) =>
  `${col}::text ~ '^[ef][0-9a-f]{7}-0000-4000-8000-'`;

/** Nhãn nghiệp vụ do spec tự đặt (song song với dải UUID ở trên). */
const QUESTION_TITLES = ["Câu E2E assessment engine", "E2E P17-T5 — câu hỏi kiểm dialog"];
const SET_TITLES = ["Bộ bài tập E2E engine", "Bộ đề thi E2E engine"];
const EXAM_TITLES = ["Kỳ thi E2E engine", "Kỳ thi tạo bằng E2E UIUX M17"];
const EXERCISE_TITLE_PATTERNS = ["Kiểm chứng P17-T1 %", "Kiểm chứng M16-007 %"];
const COURSE_TITLES = ["Khóa Phase 7 E2E"];
const INVOICE_NOTES = ["Học phí Phase 7 E2E"];
const INVOICE_CODE_PATTERNS = ["HD-E2E-P18%"];
const STUDENT_NAMES = ["HV E2E chuyển lớp", "HV E2E rút học", "HV E2E hoàn thành"];
const EVAL_COMMENTS = ["Nhận xét SMOKE"];
const NOTE_BODIES = [
  "Ghi chú nội bộ SMOKE — không được lộ cho học viên",
  "Ghi chú chia sẻ SMOKE — học viên đọc được",
  "Ghi chú tạo bằng E2E UIUX M18",
];
const SMOKE_USERNAME = "gvsmoke2607";
const SMOKE_LOGIN_EMAIL = `${SMOKE_USERNAME}@login.polymind.local`;

const list = (values: readonly string[]) =>
  values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");

const like = (col: string, patterns: readonly string[]) =>
  patterns.map((p) => `${col} like '${p.replace(/'/g, "''")}'`).join(" or ");

/*
 * Thứ tự CON → CHA. `session_replication_role = replica` tắt trigger FK nên về
 * lý thuyết thứ tự không bắt buộc, nhưng vẫn giữ đúng thứ tự để **không tạo
 * hàng mồ côi**: một `exercise_answers` do app sinh ra mang UUID ngẫu nhiên
 * (không thuộc dải fixture), nó chỉ được nhận diện qua cha của nó — xoá cha
 * trước thì mất luôn manh mối.
 */
const PURGE_SQL = `
set session_replication_role = replica;

-- ── Kho câu hỏi: các tập fixture dùng lại nhiều lần ở dưới ──────────────────
create temporary table _fx_questions on commit drop as
  select id from public.questions
   where ${FX("id")} or title in (${list(QUESTION_TITLES)});

create temporary table _fx_question_versions on commit drop as
  select id from public.question_versions
   where ${FX("id")} or question_id in (select id from _fx_questions);

create temporary table _fx_sets on commit drop as
  select id from public.question_sets
   where ${FX("id")} or title in (${list(SET_TITLES)});

create temporary table _fx_set_versions on commit drop as
  select id from public.question_set_versions
   where ${FX("id")} or question_set_id in (select id from _fx_sets);

create temporary table _fx_set_items on commit drop as
  select id from public.question_set_items
   where ${FX("id")}
      or set_version_id in (select id from _fx_set_versions)
      or question_version_id in (select id from _fx_question_versions);

create temporary table _fx_exam_deliveries on commit drop as
  select id from public.exam_deliveries
   where ${FX("id")}
      or title in (${list(EXAM_TITLES)})
      or set_version_id in (select id from _fx_set_versions);

create temporary table _fx_exam_attempts on commit drop as
  select id from public.exam_attempts
   where ${FX("id")}
      or exam_delivery_id in (select id from _fx_exam_deliveries);

create temporary table _fx_exercise_deliveries on commit drop as
  select id from public.exercise_deliveries
   where ${FX("id")}
      or (${like("title", EXERCISE_TITLE_PATTERNS)})
      or set_version_id in (select id from _fx_set_versions);

create temporary table _fx_exercise_attempts on commit drop as
  select id from public.exercise_attempts
   where ${FX("id")}
      or delivery_id in (select id from _fx_exercise_deliveries);

create temporary table _fx_queue on commit drop as
  select id from public.wrong_answer_queue
   where ${FX("id")}
      or question_version_id in (select id from _fx_question_versions)
      or source_set_item_id in (select id from _fx_set_items);

-- ── Bài thi ─────────────────────────────────────────────────────────────────
delete from public.exam_answers
 where attempt_id in (select id from _fx_exam_attempts)
    or set_item_id in (select id from _fx_set_items);
delete from public.exam_integrity_events
 where attempt_id in (select id from _fx_exam_attempts);
delete from public.exam_regrade_runs
 where exam_delivery_id in (select id from _fx_exam_deliveries);
delete from public.exam_attempts where id in (select id from _fx_exam_attempts);
delete from public.exam_deliveries where id in (select id from _fx_exam_deliveries);

-- ── Bài tập ─────────────────────────────────────────────────────────────────
delete from public.exercise_answers
 where attempt_id in (select id from _fx_exercise_attempts)
    or set_item_id in (select id from _fx_set_items);
delete from public.exercise_attempts where id in (select id from _fx_exercise_attempts);
delete from public.exercise_deliveries where id in (select id from _fx_exercise_deliveries);

-- ── Ôn câu sai ──────────────────────────────────────────────────────────────
delete from public.wrong_answer_review_attempts
 where queue_id in (select id from _fx_queue);
delete from public.wrong_answer_queue where id in (select id from _fx_queue);

-- ── Bộ câu hỏi ──────────────────────────────────────────────────────────────
delete from public.answer_media where set_item_id in (select id from _fx_set_items);
delete from public.question_set_items where id in (select id from _fx_set_items);
update public.question_sets set current_version_id = null
 where current_version_id in (select id from _fx_set_versions);
delete from public.question_set_sections
 where set_version_id in (select id from _fx_set_versions);
delete from public.question_set_versions where id in (select id from _fx_set_versions);
delete from public.question_set_shares where question_set_id in (select id from _fx_sets);
delete from public.question_sets where id in (select id from _fx_sets);

-- ── Câu hỏi ─────────────────────────────────────────────────────────────────
update public.questions set current_version_id = null
 where current_version_id in (select id from _fx_question_versions);
delete from public.question_answer_keys
 where question_version_id in (select id from _fx_question_versions);
delete from public.question_media
 where question_version_id in (select id from _fx_question_versions);
delete from public.question_options
 where question_version_id in (select id from _fx_question_versions);
delete from public.question_review_requests where question_id in (select id from _fx_questions);
delete from public.question_shares where question_id in (select id from _fx_questions);
delete from public.question_tag_links where question_id in (select id from _fx_questions);
delete from public.question_versions where id in (select id from _fx_question_versions);
delete from public.questions where id in (select id from _fx_questions);

-- ── Đánh giá & ghi chú ──────────────────────────────────────────────────────
delete from public.notifications
 where resource_id in (
   select id from public.learning_evaluations
    where ${FX("id")} or teacher_comment in (${list(EVAL_COMMENTS)})
 );
delete from public.learning_evaluations
 where ${FX("id")} or teacher_comment in (${list(EVAL_COMMENTS)});
delete from public.student_notes
 where ${FX("id")} or body in (${list(NOTE_BODIES)});

-- ── Học phí ─────────────────────────────────────────────────────────────────
create temporary table _fx_invoices on commit drop as
  select id from public.tuition_invoices
   where ${FX("id")}
      or note in (${list(INVOICE_NOTES)})
      or (${like("invoice_code", INVOICE_CODE_PATTERNS)})
      or student_id in (select id from public.students where full_name in (${list(STUDENT_NAMES)}));

delete from public.tuition_receipts
 where payment_id in (
   select id from public.tuition_payments where ${FX("id")} or invoice_id in (select id from _fx_invoices)
 );
delete from public.tuition_payments
 where ${FX("id")} or invoice_id in (select id from _fx_invoices);
delete from public.tuition_invoice_items where invoice_id in (select id from _fx_invoices);
delete from public.notifications where resource_id in (select id from _fx_invoices);
delete from public.audit_logs where resource_id in (select id from _fx_invoices);
delete from public.tuition_invoices where id in (select id from _fx_invoices);

-- ── Khóa học & học viên vòng đời (phase7-critical-flows) ────────────────────
delete from public.audit_logs
 where resource_id in (select id from public.courses where title in (${list(COURSE_TITLES)}));
delete from public.courses where title in (${list(COURSE_TITLES)});

create temporary table _fx_students on commit drop as
  select id from public.students where full_name in (${list(STUDENT_NAMES)});
create temporary table _fx_enrollments on commit drop as
  select id from public.enrollments where student_id in (select id from _fx_students);

delete from public.audit_logs where resource_id in (select id from _fx_enrollments);
delete from public.enrollment_status_history
 where enrollment_id in (select id from _fx_enrollments);
delete from public.enrollments where id in (select id from _fx_enrollments);
delete from public.students where id in (select id from _fx_students);

-- ── Tài khoản do admin-accounts.smoke tạo ───────────────────────────────────
delete from public.audit_logs where resource_id in (
  select id from public.teachers
   where user_id in (select id from public.profiles where username = '${SMOKE_USERNAME}')
);
delete from public.teachers
 where user_id in (select id from public.profiles where username = '${SMOKE_USERNAME}');
delete from public.audit_logs
 where resource_id in (select id from public.profiles where username = '${SMOKE_USERNAME}');
delete from public.profiles where username = '${SMOKE_USERNAME}';
delete from auth.users where email = '${SMOKE_LOGIN_EMAIL}';

set session_replication_role = origin;
`;

/** Đếm lại sau khi dọn — có số để ghi vào báo cáo, không nói "chắc là sạch". */
const VERIFY_SQL = `
select 'exam_deliveries=' || (select count(*) from public.exam_deliveries where ${FX("id")} or title in (${list(EXAM_TITLES)}))
    || ' · exercise_deliveries=' || (select count(*) from public.exercise_deliveries where ${FX("id")} or (${like("title", EXERCISE_TITLE_PATTERNS)}))
    || ' · question_sets=' || (select count(*) from public.question_sets where ${FX("id")} or title in (${list(SET_TITLES)}))
    || ' · questions=' || (select count(*) from public.questions where ${FX("id")} or title in (${list(QUESTION_TITLES)}))
    || ' · wrong_answer_queue=' || (select count(*) from public.wrong_answer_queue where ${FX("id")})
    || ' · learning_evaluations=' || (select count(*) from public.learning_evaluations where ${FX("id")} or teacher_comment in (${list(EVAL_COMMENTS)}))
    || ' · student_notes=' || (select count(*) from public.student_notes where ${FX("id")} or body in (${list(NOTE_BODIES)}))
    || ' · tuition_invoices=' || (select count(*) from public.tuition_invoices where ${FX("id")} or note in (${list(INVOICE_NOTES)}) or (${like("invoice_code", INVOICE_CODE_PATTERNS)}))
    || ' · students=' || (select count(*) from public.students where full_name in (${list(STUDENT_NAMES)}))
    || ' · profiles=' || (select count(*) from public.profiles where username = '${SMOKE_USERNAME}');
`;

function psql(query: string): string {
  try {
    return execFileSync(
      "docker",
      ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      { encoding: "utf8", input: query },
    ).trim();
  } catch (error) {
    // Hỏng ở đây phải **dừng cả suite**, không được chạy tiếp: chạy tiếp nghĩa là
    // chạy trên một DB có thể còn rác, tức đúng tình huống mà file này sinh ra để
    // chặn. Ném kèm stderr của psql để biết ngay là Docker chưa bật hay SQL sai.
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString().trim();
    throw new Error(
      `[global-setup] không dọn được fixture E2E — suite dừng tại đây.\n` +
        `Kiểm tra Docker và container \`${DB}\` (\`npx supabase start\`).\n` +
        (stderr ? `psql/docker báo: ${stderr}` : String(error)),
    );
  }
}

export default function globalSetup() {
  // Cả khối chạy trong MỘT giao dịch: `create temporary table … on commit drop`
  // cần vậy, và nếu nửa chừng lỗi thì DB không nằm lại ở trạng thái dọn dở.
  psql(`begin;\n${PURGE_SQL}\ncommit;`);
  const remaining = psql(VERIFY_SQL);
  console.log(`[global-setup] đã dọn dải fixture E2E — còn lại: ${remaining}`);
}
