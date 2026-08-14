/**
 * Dựng nội dung báo cáo ở dạng "mục → các dòng nhãn/giá trị".
 *
 * =============================================================================
 * 🔴 MỘT NGUỒN CHO BA BỀ MẶT
 * =============================================================================
 *
 * Bản xem của giáo vụ · bản in PDF · bản xuất DOCX đều đọc từ hàm này. Ba đường
 * xuất mà lắp nội dung ba lần là có ngày PDF và DOCX nói hai chuyện khác nhau
 * về cùng một buổi dạy — đúng hình dạng `BUG_M10_01`.
 *
 * =============================================================================
 * "KHÔNG THÊM KHÔNG BỚT" NGHĨA LÀ GÌ Ở ĐÂY (`D-43` điểm 3)
 * =============================================================================
 *
 * **Không bớt:** đủ cả 9 mục và phần XÁC NHẬN, đúng nhãn của `docs/BaoCao.pdf`.
 * Ô nào giáo viên để trống thì in `—` chứ KHÔNG bỏ dòng đi — người đọc phải
 * phân biệt được "có hỏi mà bỏ trống" với "không hỏi".
 *
 * **Không thêm:** không sinh thêm trường nào ngoài mẫu, không tự bình luận,
 * không chèn biểu đồ.
 *
 * ⚠️ Ảnh minh chứng của mục 8 KHÔNG phải là "thêm": mẫu có sẵn dòng *"Tải
 * file/hình ảnh"*, và một bản báo cáo in ra mà chỉ ghi *"3 tệp đính kèm"* rồi
 * không cho xem ba tệp đó là **bớt** — người đọc mất đúng phần minh chứng.
 *
 * **Trình bày thì thiết kế lại:** mẫu Word in cả 5 dòng ☐ rồi tick một dòng.
 * Ở đây chỉ in *dòng được chọn* kèm nguyên văn mô tả của nó. Chữ nghĩa không
 * mất chữ nào; bốn dòng thừa thì mất.
 */

import {
  COMPREHENSION_LEVELS,
  CONFIRMATION_TEXT,
  FOCUS_LEVELS,
  INTERACTION_LEVELS,
  SECTION_TITLES,
  STUDENT_CATEGORIES,
  evidenceKindLabel,
  homeworkCompletionLabel,
  issueCategoryLabel,
  issueImpactLabel,
  issueSeverityOption,
  modeLabel,
  overallRatingOption,
  planCompletionLabel,
  ratingSentence,
} from "./labels";

/** Ô trống in dấu gạch dài, không bỏ dòng. */
export const BLANK = "—";

export type RenderLine = {
  label: string;
  value: string;
  /** Vị trí trên thang 1–5, để bản in vẽ dãy chấm. Null khi không phải thang. */
  scale?: { value: number; max: number } | null;
};

/**
 * Một tệp minh chứng của mục 8, đã sẵn sàng để HIỆN chứ không chỉ để đếm.
 *
 * 🔴 Vì sao có `url` lẫn `storagePath`: bản xem và bản in nhúng thẳng `url` (URL
 * ký hạn ngắn) vào `<img>`; bản DOCX thì phải TẢI NHỊ PHÂN về nhét vào file
 * Word, và nó tải theo `storagePath` qua chính client đã bị RLS thu hẹp — không
 * đi vòng qua URL ký, để một URL hết hạn giữa chừng không làm rỗng file Word.
 */
export type RenderEvidence = {
  id: string;
  /** Tên tệp gốc, đã bỏ tiền tố uuid — thứ con người đọc được. */
  fileName: string;
  bytes: number;
  storagePath: string;
  /** Null khi Storage không ký được — bề mặt tự quyết hiển thị gì thay thế. */
  url: string | null;
};

export type RenderSection = {
  number: number;
  title: string;
  lines: RenderLine[];
  /**
   * Ảnh đính kèm của mục (chỉ mục 8 có).
   *
   * Nằm TRONG mục chứ không nằm rời bên ngoài: ba bề mặt cùng lặp qua
   * `buildReportSections()`, nên ảnh gắn vào đúng mục là ba bề mặt cùng có ảnh.
   * Bản trước chỉ đưa ra con số "3 tệp đính kèm" — đọc bản in xong vẫn không
   * biết ba tệp đó là gì (user báo 2026-08-14).
   */
  images?: RenderEvidence[];
};

export type ReportSnapshotStudent = {
  enrollment_id: string;
  full_name: string;
  student_code: string;
  status: string | null;
  note: string | null;
};

export type ReportForRender = {
  session: {
    classCode: string;
    className: string;
    teacherName: string;
    /** NGÀY học, đã định dạng — `10/08/2026`. */
    startsAt: string;
    /**
     * GIỜ bắt đầu, đã định dạng — `08:00`.
     *
     * 🔴 Tách riêng khỏi `startsAt` vì dòng *"Thời gian"* từng in ra
     * `10/08/2026 – 09:30`: nó ghép NGÀY bắt đầu với GIỜ kết thúc, do cả hai
     * cùng đọc từ một trường đã định dạng sẵn thành ngày (user báo kèm ảnh
     * 2026-08-14, thấy trên cả bản DOCX lẫn bản in).
     */
    startTime: string;
    /** GIỜ kết thúc, đã định dạng — `09:30`. */
    endsAt: string;
    sessionNumber: number;
    lessonTitle: string | null;
    lessonLog: string | null;
    teacherNote: string | null;
  };
  report: Record<string, unknown>;
  students: { category: string; fullName: string; note: string | null }[];
  evidence: RenderEvidence[];
  /** Ảnh chụp chuyên cần lúc gửi. */
  snapshot: {
    roster_size?: number;
    present?: number;
    late?: number;
    absent?: number;
    excused?: number;
    students?: ReportSnapshotStudent[];
  } | null;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return BLANK;
  const str = String(value).trim();
  return str.length > 0 ? str : BLANK;
}

function yesNo(value: unknown, yes = "Có", no = "Không"): string {
  if (value === null || value === undefined) return BLANK;
  return value ? yes : no;
}

function joinNames(
  students: ReportForRender["students"],
  category: string,
): string {
  const matched = students.filter((item) => item.category === category);
  if (matched.length === 0) return BLANK;
  return matched
    .map((item) => (item.note?.trim() ? `${item.fullName} — ${item.note.trim()}` : item.fullName))
    .join("; ");
}

export function buildReportSections(data: ReportForRender): RenderSection[] {
  const r = data.report;
  const snapshot = data.snapshot;

  // --- Mục 2: danh sách vắng / đi trễ lấy từ ẢNH CHỤP, không tính lại ---------
  const absentNames = (snapshot?.students ?? [])
    .filter((item) => item.status === "absent")
    .map((item) => item.full_name);
  const lateNames = (snapshot?.students ?? [])
    .filter((item) => item.status === "late" || item.status === "excused")
    .map((item) => item.full_name);
  const reasons = (snapshot?.students ?? [])
    .filter((item) => item.note?.trim())
    .map((item) => `${item.full_name}: ${item.note?.trim()}`);

  const sections: RenderSection[] = [
    {
      number: 1,
      title: SECTION_TITLES[0]!,
      lines: [
        { label: "Tên lớp", value: `${data.session.classCode} — ${data.session.className}` },
        { label: "Giáo viên", value: text(data.session.teacherName) },
        { label: "Ngày học", value: data.session.startsAt },
        { label: "Thời gian", value: `${data.session.startTime} – ${data.session.endsAt}` },
        { label: "Buổi số", value: String(data.session.sessionNumber) },
        { label: "Hình thức", value: modeLabel(r.mode as string) ?? BLANK },
        { label: "Bài/Chủ đề giảng dạy", value: text(r.topic) },
      ],
    },
    {
      number: 2,
      title: SECTION_TITLES[1]!,
      lines: [
        { label: "Sĩ số lớp", value: `${snapshot?.roster_size ?? BLANK} học viên` },
        { label: "Có mặt", value: String(snapshot?.present ?? BLANK) },
        { label: "Vắng", value: String(snapshot?.absent ?? BLANK) },
        { label: "Học viên vắng", value: absentNames.length ? absentNames.join(", ") : BLANK },
        { label: "Đi trễ/Về sớm", value: lateNames.length ? lateNames.join(", ") : BLANK },
        {
          label: "Lý do vắng/đi trễ/về sớm",
          value: reasons.length ? reasons.join("; ") : BLANK,
        },
      ],
    },
    {
      number: 3,
      title: SECTION_TITLES[2]!,
      lines: [
        { label: "Bài học đã dạy", value: text(data.session.lessonTitle) },
        { label: "Nội dung đã giảng", value: text(data.session.lessonLog) },
        {
          label: "Mức độ hoàn thành kế hoạch buổi học",
          value: planCompletionLabel(r.plan_completion as string) ?? BLANK,
        },
        {
          label: "Nội dung chưa hoàn thành",
          value: r.has_unfinished ? text(r.unfinished_content) : "Không có",
        },
        { label: "Lý do chưa hoàn thành", value: r.has_unfinished ? text(r.unfinished_reason) : BLANK },
        {
          label: "Bài tập/Bài luyện tập đã giao",
          value: r.has_homework ? text(r.homework_assigned) : "Không có",
        },
      ],
    },
    {
      number: 4,
      title: SECTION_TITLES[3]!,
      lines: [
        {
          label: "4.1. Mức độ tiếp thu chung của học viên",
          value: ratingSentence(COMPREHENSION_LEVELS, r.comprehension_level as number) ?? BLANK,
          scale: r.comprehension_level ? { value: r.comprehension_level as number, max: 5 } : null,
        },
        {
          label: "4.2. Mức độ tương tác trong lớp",
          value: ratingSentence(INTERACTION_LEVELS, r.interaction_level as number) ?? BLANK,
          scale: r.interaction_level ? { value: r.interaction_level as number, max: 5 } : null,
        },
        {
          label: "4.3. Mức độ tập trung",
          value: ratingSentence(FOCUS_LEVELS, r.focus_level as number) ?? BLANK,
          scale: r.focus_level ? { value: r.focus_level as number, max: 5 } : null,
        },
        {
          label: "4.4. Tình hình hoàn thành bài tập",
          value: homeworkCompletionLabel(r.homework_completion as string) ?? BLANK,
        },
      ],
    },
    {
      number: 5,
      title: SECTION_TITLES[4]!,
      lines: r.no_students_of_note
        ? [
            {
              label: "Kết luận",
              value: "Không có học viên cần lưu ý trong buổi học này",
            },
          ]
        : STUDENT_CATEGORIES.filter((item) => item.section === 5).map((category) => ({
            label: category.label,
            value: joinNames(data.students, category.value),
          })),
    },
    {
      number: 6,
      title: SECTION_TITLES[5]!,
      lines: [
        { label: "Buổi học có vấn đề phát sinh không?", value: yesNo(r.has_issue) },
        {
          label: "Nhóm vấn đề",
          value: Array.isArray(r.issue_categories) && r.issue_categories.length
            ? (r.issue_categories as string[]).map(issueCategoryLabel).join(", ") +
              (r.issue_other ? ` (${String(r.issue_other)})` : "")
            : BLANK,
        },
        { label: "Mô tả ngắn vấn đề", value: text(r.issue_description) },
        {
          label: "Ảnh hưởng đến buổi học",
          value: issueImpactLabel(r.issue_impact as string) ?? BLANK,
        },
        {
          label: "Mức độ cần xử lý",
          value: (() => {
            const option = issueSeverityOption(r.issue_severity as string);
            return option ? `${option.label} — ${option.description}` : BLANK;
          })(),
        },
      ],
    },
    {
      number: 7,
      title: SECTION_TITLES[6]!,
      lines: [
        { label: "Nội dung dự kiến", value: text(r.next_content) },
        { label: "Nội dung cần ôn lại/củng cố", value: text(r.review_content) },
        { label: "Học viên cần theo dõi thêm", value: joinNames(data.students, "follow_up_next") },
        { label: "Nội dung cần giáo viên lưu ý", value: text(r.teacher_watch_note) },
        {
          label: "Giáo viên có cần bộ phận đào tạo hỗ trợ không?",
          value: r.needs_support ? `Có — ${text(r.support_request)}` : "Không",
        },
      ],
    },
    {
      number: 8,
      title: SECTION_TITLES[7]!,
      lines: [
        {
          label: "Loại minh chứng",
          value: Array.isArray(r.evidence_kinds) && r.evidence_kinds.length
            ? (r.evidence_kinds as string[]).map(evidenceKindLabel).join(", ")
            : BLANK,
        },
        {
          // Con số ĐI KÈM tên từng tệp, không đứng một mình. Bản in đen trắng
          // gửi cấp trên phải nói được "ba tệp đó tên gì", còn chính ảnh thì
          // nằm ở `images` ngay dưới.
          label: "Tải file/hình ảnh",
          value:
            data.evidence.length > 0
              ? `${data.evidence.length} tệp đính kèm: ${data.evidence
                  .map((item) => item.fileName)
                  .join(", ")}`
              : BLANK,
        },
      ],
      images: data.evidence,
    },
    {
      number: 9,
      title: SECTION_TITLES[8]!,
      lines: [
        {
          label: "Đánh giá chung về buổi học",
          value: (() => {
            const option = overallRatingOption(r.overall_rating as string);
            return option ? `${option.label} — ${option.description}` : BLANK;
          })(),
        },
        { label: "Nhận xét hoặc đề xuất thêm", value: text(r.closing_note) },
      ],
    },
  ];

  return sections;
}

/** Dòng XÁC NHẬN cuối bản in — nguyên văn mẫu, kèm dấu vết ký. */
export function buildConfirmationLine(
  data: ReportForRender,
  submittedBy: string,
  submittedAt: string,
): RenderLine {
  return {
    label: "XÁC NHẬN",
    value: data.report.confirmed
      ? `${CONFIRMATION_TEXT} (${submittedBy} · ${submittedAt})`
      : BLANK,
  };
}
