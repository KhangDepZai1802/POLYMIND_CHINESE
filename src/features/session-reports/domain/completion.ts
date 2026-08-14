/**
 * Luật tính "một mục đã xong chưa" của biểu mẫu Báo cáo sau buổi dạy.
 *
 * =============================================================================
 * 🔴 HAI LUẬT USER CHỐT Ở `D-43`, ĐỪNG NỚI
 * =============================================================================
 *
 * **(6) Trạng thái tính từ NỘI DUNG ĐÃ LƯU, không phải từ việc đã ghé qua mục.**
 * Không có tham số nào ở đây nói "giáo viên đã mở mục N" — và đó là cố ý. Mở
 * mục 7 ra ngắm rồi vuốt sang mục khác thì nó vẫn là `empty`. Ngược lại, mục đã
 * điền đủ thì `done` ngay cả khi giáo viên chưa từng cuộn tới (ví dụ viết tiếp
 * một bản nháp từ hôm trước).
 *
 * ⚠️ Nếu có ai đó sau này "tối ưu" bằng cách nhớ mục đã ghé — dừng lại. Đó
 * chính là hành vi user đã bác bỏ.
 *
 * **(5) Bỏ trống KHÔNG được tính là đã trả lời** ở mục 5 và mục 6. Buổi bình
 * thường thì đúng là không có gì để ghi, nhưng nếu để trống mà tự tính xong thì
 * giáo viên bỏ qua hẳn hai mục cũng ra 9/9 — con số mất hết ý nghĩa. Muốn xong
 * phải nói ra: tick "Không có học viên cần lưu ý" hoặc chọn "Không" ở vấn đề
 * phát sinh. Một cú chạm, đổi "tôi chưa xem" thành "tôi đã xem, không có gì".
 *
 * =============================================================================
 * MỘT LUẬT, MỘT NƠI
 * =============================================================================
 *
 * `isComplete` ở đây CHÍNH LÀ điều kiện mà nút *Gửi báo cáo* dùng để chặn. Mục
 * lục và nút Gửi không được có hai luật riêng — hai luật thì sẽ có ngày mục lục
 * báo 9/9 xong mà nút Gửi vẫn kêu thiếu, và người dùng không cách nào đoán được
 * bên nào đúng.
 *
 * ⛔ Phần này KHÔNG chép sang plpgsql. RPC `submit_session_report` chỉ canh mấy
 * vế an ninh (đúng giáo viên · còn nháp · ĐÃ ĐIỂM DANH ĐỦ · đã tick xác nhận) —
 * những thứ không bao giờ được phép lách. Độ đầy đủ của biểu mẫu là luật hình
 * thức, sống ở đây thôi.
 */

import { EVIDENCE_KINDS, SECTION_TITLES } from "./labels";
import type {
  EvidenceKind,
  HomeworkCompletion,
  IssueCategory,
  IssueImpact,
  IssueSeverity,
  OverallRating,
  PlanCompletion,
  SessionReportMode,
  StudentCategory,
} from "./labels";

/** Hình dạng biểu mẫu — đúng những gì giáo viên gõ vào. */
export type SessionReportForm = {
  // Mục 1
  mode: SessionReportMode | null;
  topic: string;
  // Mục 3 (phần KHÔNG thuộc nhật ký buổi học)
  //
  // 🔴 `lesson_title` là chữ giáo viên TỰ GÕ, không phải id tra từ giáo trình
  // (`TEACHER-REPORT-2`). Bản đầu đọc `class_sessions.lesson_id`; khoá chưa
  // nhập giáo trình thì ô đó không chọn được gì ⇒ mục 3 mãi "chưa xong" ⇒ nút
  // Gửi bị chặn vĩnh viễn. Liên kết tiến độ bài học vẫn ở `lesson_id`, chỉ là
  // biểu mẫu này thôi không ghi vào đó nữa.
  lesson_title: string;
  plan_completion: PlanCompletion | null;
  has_unfinished: boolean;
  unfinished_content: string;
  unfinished_reason: string;
  has_homework: boolean;
  homework_assigned: string;
  // Mục 4
  comprehension_level: number | null;
  interaction_level: number | null;
  focus_level: number | null;
  homework_completion: HomeworkCompletion | null;
  // Mục 5
  no_students_of_note: boolean;
  // Mục 6
  has_issue: boolean | null;
  issue_categories: IssueCategory[];
  issue_other: string;
  issue_description: string;
  issue_impact: IssueImpact | null;
  issue_severity: IssueSeverity | null;
  // Mục 7
  next_content: string;
  review_content: string;
  teacher_watch_note: string;
  needs_support: boolean;
  support_request: string;
  // Mục 8
  evidence_kinds: EvidenceKind[];
  // Mục 9
  overall_rating: OverallRating | null;
  closing_note: string;
  // XÁC NHẬN
  confirmed: boolean;
};

export type ReportStudentEntry = {
  category: StudentCategory;
  enrollment_id: string;
  note: string;
};

/**
 * Những thứ mục lục cần mà KHÔNG nằm trong biểu mẫu:
 *
 * - `lesson.lessonLog` — "Nội dung đã giảng" sống ở `class_sessions` (một đường
 *   ghi, xem `D-43` điểm 1). ⚠️ KHÔNG còn `lessonId`: từ `TEACHER-REPORT-2`,
 *   "Bài học đã dạy" là `form.lesson_title` do giáo viên tự gõ.
 * - `evidenceCount` — mục 8 đếm file đã tải lên
 *
 * ⛔ KHÔNG có `attendance` ở đây nữa (`TEACHER-REPORT-3`). Mục 2 đọc thẳng từ
 * điểm danh và không còn điều kiện nào để "xong" — xem khối mục 2 bên dưới.
 */
export type CompletionInput = {
  form: SessionReportForm;
  lesson: { lessonLog: string };
  students: ReportStudentEntry[];
  evidenceCount: number;
};

export type SectionState = "done" | "partial" | "empty";

export type SectionStatus = {
  /** 1…9 — đúng thứ tự mục trong `docs/BaoCao.pdf`. */
  number: number;
  title: string;
  state: SectionState;
  /** Câu nói rõ còn thiếu gì. Null khi đã xong. */
  hint: string | null;
};

export const SECTION_COUNT = SECTION_TITLES.length;

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Gộp ba mảnh thành một trạng thái.
 *
 * `done` khi mọi điều kiện bắt buộc đều đúng; `empty` khi CHƯA chạm gì; còn lại
 * là `partial`. Tách `touched` khỏi `ok` chính là chỗ phân biệt "chưa điền" với
 * "điền dở" — thiếu nó thì mọi mục chưa xong đều trông giống nhau.
 */
function resolve(ok: boolean, touched: boolean): SectionState {
  if (ok) return "done";
  return touched ? "partial" : "empty";
}

export function getSectionStatuses(input: CompletionInput): SectionStatus[] {
  const { form, lesson, students, evidenceCount } = input;

  const statuses: Omit<SectionStatus, "title">[] = [];

  // --- Mục 1 ----------------------------------------------------------------
  {
    const hasMode = form.mode !== null;
    const hasTopic = filled(form.topic);
    statuses.push({
      number: 1,
      state: resolve(hasMode && hasTopic, hasMode || hasTopic),
      hint: hasMode && hasTopic
        ? null
        : !hasMode && !hasTopic
          ? "Chưa chọn hình thức và chưa nhập bài / chủ đề"
          : !hasMode
            ? "Chưa chọn hình thức"
            : "Chưa nhập bài / chủ đề giảng dạy",
    });
  }

  // --- Mục 2 ----------------------------------------------------------------
  //
  // 🔴 LUÔN `done` — LÝ DO VẮNG LÀ TUỲ CHỌN (`TEACHER-REPORT-3`, user chốt
  // 2026-08-14: *"vắng không cần phải có lí do, đừng ràng buộc cái này dẫn đến
  // không thể gửi báo cáo"*).
  //
  // Bản trước đòi mỗi người vắng / đi trễ phải có một dòng lý do thì mục 2 mới
  // xong. Đó là cổng đặt SAI CHỖ, đúng hình dạng đã mắc ở `TEACHER-REPORT-2`:
  // giáo viên thường không biết vì sao học viên vắng — người biết là bộ phận
  // tuyển sinh, và có khi mấy hôm sau mới biết. Bắt gõ lý do mới cho gửi tức là
  // hoặc chặn báo cáo vô thời hạn, hoặc ép bịa một lý do vào hồ sơ học viên.
  //
  // Mục này KHÔNG còn điều kiện nào vì đúng là chẳng còn gì để điền: sĩ số /
  // có mặt / vắng đọc thẳng từ điểm danh (`D-43` điểm 2, không có ô gõ tay), mà
  // ĐIỂM DANH ĐỦ thì đã là cổng cứng ở ba tầng — trang biểu mẫu không dựng lên
  // khi chưa điểm danh xong, và RPC `submit_session_report` chặn lần cuối. Ô lý
  // do vẫn còn để giáo viên ghi khi có biết, chỉ là không ai bị chặn vì nó.
  {
    statuses.push({ number: 2, state: "done", hint: null });
  }

  // --- Mục 3 ----------------------------------------------------------------
  {
    const hasLesson = filled(form.lesson_title);
    const hasLog = filled(lesson.lessonLog);
    const hasPlan = form.plan_completion !== null;
    const unfinishedOk =
      !form.has_unfinished ||
      (filled(form.unfinished_content) && filled(form.unfinished_reason));
    const homeworkOk = !form.has_homework || filled(form.homework_assigned);

    const ok = hasLesson && hasLog && hasPlan && unfinishedOk && homeworkOk;
    const touched = hasLesson || hasLog || hasPlan;

    const missing: string[] = [];
    if (!hasLesson) missing.push("bài học đã dạy");
    if (!hasLog) missing.push("nội dung đã giảng");
    if (!hasPlan) missing.push("mức độ hoàn thành");
    if (!unfinishedOk) missing.push("mô tả và lý do phần chưa hoàn thành");
    if (!homeworkOk) missing.push("nội dung bài tập đã giao");

    statuses.push({
      number: 3,
      state: resolve(ok, touched),
      hint: ok ? null : `Chưa có ${missing.join(" · ")}`,
    });
  }

  // --- Mục 4 ----------------------------------------------------------------
  {
    const levels = [
      form.comprehension_level,
      form.interaction_level,
      form.focus_level,
    ];
    const chosen = levels.filter((value) => value !== null).length;
    const hasHomeworkScale = form.homework_completion !== null;
    const ok = chosen === 3 && hasHomeworkScale;
    const total = chosen + (hasHomeworkScale ? 1 : 0);

    statuses.push({
      number: 4,
      state: resolve(ok, total > 0),
      hint: ok ? null : `Mới chọn ${total}/4 thang đánh giá`,
    });
  }

  // --- Mục 5 ----------------------------------------------------------------
  // Vế `D-43` điểm 5: bỏ trống KHÔNG phải là câu trả lời.
  {
    const section5 = students.filter((item) => item.category !== "follow_up_next");
    const withoutNote = section5.filter((item) => !filled(item.note)).length;

    let state: SectionState;
    let hint: string | null;

    if (form.no_students_of_note) {
      state = "done";
      hint = null;
    } else if (section5.length === 0) {
      state = "empty";
      hint = "Chưa chọn học viên nào, cũng chưa tick “Không có học viên cần lưu ý”";
    } else if (withoutNote > 0) {
      state = "partial";
      hint = `Đã chọn ${section5.length} học viên · ${withoutNote} người chưa có nhận xét`;
    } else {
      state = "done";
      hint = null;
    }

    statuses.push({ number: 5, state, hint });
  }

  // --- Mục 6 ----------------------------------------------------------------
  {
    let state: SectionState;
    let hint: string | null;

    if (form.has_issue === null) {
      state = "empty";
      hint = "Chưa trả lời buổi học có vấn đề phát sinh hay không";
    } else if (form.has_issue === false) {
      state = "done";
      hint = null;
    } else {
      const missing: string[] = [];
      if (form.issue_categories.length === 0) missing.push("nhóm vấn đề");
      if (!filled(form.issue_description)) missing.push("mô tả");
      if (form.issue_impact === null) missing.push("mức ảnh hưởng");
      if (form.issue_severity === null) missing.push("mức cần xử lý");
      state = missing.length === 0 ? "done" : "partial";
      hint = missing.length === 0 ? null : `Chưa có ${missing.join(" · ")}`;
    }

    statuses.push({ number: 6, state, hint });
  }

  // --- Mục 7 ----------------------------------------------------------------
  {
    const hasNext = filled(form.next_content);
    const supportOk = !form.needs_support || filled(form.support_request);
    const ok = hasNext && supportOk;
    const touched =
      hasNext ||
      filled(form.review_content) ||
      filled(form.teacher_watch_note) ||
      form.needs_support;

    statuses.push({
      number: 7,
      state: resolve(ok, touched),
      hint: ok
        ? null
        : !hasNext
          ? "Chưa nhập nội dung dự kiến buổi sau"
          : "Đã chọn cần hỗ trợ nhưng chưa ghi nội dung cần hỗ trợ",
    });
  }

  // --- Mục 8 ----------------------------------------------------------------
  // Tick loại minh chứng là ẢNH thì phải có ảnh thật. Tick rồi bỏ trống là một
  // lời khai không có gì chứng minh.
  {
    const kinds = form.evidence_kinds;
    const needsFile = kinds.some(
      (kind) => EVIDENCE_KINDS.find((item) => item.value === kind)?.needsFile,
    );
    const fileOk = !needsFile || evidenceCount > 0;
    const ok = kinds.length > 0 && fileOk;
    const touched = kinds.length > 0 || evidenceCount > 0;

    statuses.push({
      number: 8,
      state: resolve(ok, touched),
      hint: ok
        ? null
        : kinds.length === 0
          ? evidenceCount > 0
            ? `Đã tải ${evidenceCount} ảnh · chưa chọn loại minh chứng`
            : "Chưa chọn loại minh chứng nào"
          : "Đã tick loại minh chứng là ảnh nhưng chưa tải ảnh nào",
    });
  }

  // --- Mục 9 ----------------------------------------------------------------
  {
    const ok = form.overall_rating !== null;
    statuses.push({
      number: 9,
      state: resolve(ok, filled(form.closing_note)),
      hint: ok ? null : "Chưa chọn đánh giá chung về buổi học",
    });
  }

  return statuses.map((item) => ({
    ...item,
    title: SECTION_TITLES[item.number - 1] ?? `Mục ${item.number}`,
  }));
}

export type ReportCompletion = {
  sections: SectionStatus[];
  doneCount: number;
  /** Đủ 9 mục — CHÍNH LÀ điều kiện nút *Gửi báo cáo* dùng. */
  isComplete: boolean;
  /** Các mục còn thiếu, để bảng "chưa gửi được vì…" liệt kê. */
  missing: SectionStatus[];
};

export function getReportCompletion(input: CompletionInput): ReportCompletion {
  const sections = getSectionStatuses(input);
  const missing = sections.filter((section) => section.state !== "done");

  return {
    sections,
    doneCount: sections.length - missing.length,
    isComplete: missing.length === 0,
    missing,
  };
}

/** Biểu mẫu rỗng — dùng khi giáo viên mở báo cáo lần đầu. */
export function emptySessionReportForm(): SessionReportForm {
  return {
    mode: null,
    topic: "",
    lesson_title: "",
    plan_completion: null,
    // Hai ô Không/Có mặc định là "Không": biểu mẫu giấy cũng ngầm hiểu vậy, và
    // để `null` thì mục 3 mắc kẹt ở "đang dở" dù giáo viên đã điền đủ ba ô
    // bắt buộc.
    has_unfinished: false,
    unfinished_content: "",
    unfinished_reason: "",
    has_homework: false,
    homework_assigned: "",
    comprehension_level: null,
    interaction_level: null,
    focus_level: null,
    homework_completion: null,
    no_students_of_note: false,
    // ⚠️ Mục 6 thì KHÁC: `null` là cố ý, không phải quên. `D-43` điểm 5 đòi
    // giáo viên phải trả lời rõ "Không" thì mục mới được tính là xong.
    has_issue: null,
    issue_categories: [],
    issue_other: "",
    issue_description: "",
    issue_impact: null,
    issue_severity: null,
    next_content: "",
    review_content: "",
    teacher_watch_note: "",
    needs_support: false,
    support_request: "",
    evidence_kinds: [],
    overall_rating: null,
    closing_note: "",
    confirmed: false,
  };
}
