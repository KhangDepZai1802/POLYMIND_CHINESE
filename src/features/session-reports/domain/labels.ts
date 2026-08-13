/**
 * Nhãn của biểu mẫu Báo cáo sau buổi dạy — NGUYÊN VĂN theo `docs/BaoCao.pdf`.
 *
 * 🔴 ĐÂY LÀ NGUỒN SỰ THẬT DUY NHẤT VỀ CÂU CHỮ. Biểu mẫu giáo viên, bản xem của
 * giáo vụ, bản in PDF và bản xuất DOCX đều đọc từ đây.
 *
 * `D-43` điểm 3: user chốt *"nội dung cần đúng i chang mẫu, không thêm không
 * bớt"*. Gõ lại câu chữ ở chỗ khác là có ngày bản in nói khác biểu mẫu — đúng
 * thứ mà bài học "docs lệch source" trong `CLAUDE.md` cảnh báo.
 *
 * Mỗi thang có `description` tách khỏi `label` vì hai chỗ dùng khác nhau: màn
 * hẹp chỉ đủ chỗ cho `label`, còn bản in thì in cả hai.
 */

export const SESSION_REPORT_MODES = [
  { value: "offline", label: "Offline" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export type SessionReportMode = (typeof SESSION_REPORT_MODES)[number]["value"];

/** Mục 3 — mức độ hoàn thành kế hoạch buổi học. */
export const PLAN_COMPLETIONS = [
  { value: "lt_50", label: "Dưới 50%" },
  { value: "50_69", label: "50–69%" },
  { value: "70_89", label: "70–89%" },
  { value: "90_100", label: "90–100%" },
] as const;

export type PlanCompletion = (typeof PLAN_COMPLETIONS)[number]["value"];

/** Mục 4.1 — mức độ tiếp thu chung của học viên. */
export const COMPREHENSION_LEVELS = [
  { value: 1, label: "Chưa đạt", description: "Phần lớn học viên chưa hiểu bài" },
  { value: 2, label: "Cần cải thiện", description: "Một số nội dung học viên chưa nắm được" },
  { value: 3, label: "Đạt", description: "Hiểu kiến thức cơ bản nhưng cần ôn thêm" },
  { value: 4, label: "Tốt", description: "Nắm được phần lớn nội dung" },
  { value: 5, label: "Rất tốt", description: "Hiểu bài rõ, có thể vận dụng tốt" },
] as const;

/** Mục 4.2 — mức độ tương tác trong lớp. */
export const INTERACTION_LEVELS = [
  { value: 1, label: "Không tương tác", description: "" },
  { value: 2, label: "Ít tương tác", description: "Ít phản hồi hoặc thiếu tập trung" },
  { value: 3, label: "Trung bình", description: "Có tham gia nhưng chưa chủ động" },
  { value: 4, label: "Tích cực", description: "Tham gia tốt khi giáo viên yêu cầu" },
  { value: 5, label: "Rất tích cực", description: "Chủ động hỏi, trả lời và tham gia hoạt động" },
] as const;

/** Mục 4.3 — mức độ tập trung. */
export const FOCUS_LEVELS = [
  { value: 1, label: "Ảnh hưởng đến việc học", description: "" },
  { value: 2, label: "Thiếu tập trung", description: "" },
  { value: 3, label: "Bình thường", description: "" },
  { value: 4, label: "Tốt", description: "" },
  { value: 5, label: "Rất tốt", description: "" },
] as const;

export type RatingOption = {
  readonly value: number;
  readonly label: string;
  readonly description: string;
};

/**
 * Mục 4.4 — KHÔNG phải thang 1–5.
 *
 * Bốn mốc phần trăm là một thang có thứ tự; `no_homework` là trạng thái "không
 * áp dụng", không nằm trên thang đó. Gộp cả năm thành năm nút cùng cỡ là nói
 * dối về hình dạng dữ liệu, nên giao diện tách chúng làm hai khối.
 */
export const HOMEWORK_COMPLETIONS = [
  { value: "gt_90", label: "Trên 90%", onScale: true },
  { value: "70_89", label: "70–89%", onScale: true },
  { value: "50_69", label: "50–69%", onScale: true },
  { value: "lt_50", label: "Dưới 50%", onScale: true },
  { value: "no_homework", label: "Chưa có bài tập cần kiểm tra", onScale: false },
] as const;

export type HomeworkCompletion = (typeof HOMEWORK_COMPLETIONS)[number]["value"];

/** Mục 5 + mục 7 — các nhóm học viên cần nhắc tên. */
export const STUDENT_CATEGORIES = [
  {
    value: "outstanding",
    label: "Học viên nổi bật / có tiến bộ",
    noteLabel: "Nhận xét",
    section: 5,
  },
  {
    value: "needs_support",
    label: "Học viên tiếp thu chậm / cần hỗ trợ thêm",
    noteLabel: "Nội dung cần hỗ trợ",
    section: 5,
  },
  {
    value: "low_engagement",
    label: "Học viên thiếu tập trung / ít tương tác",
    noteLabel: "Nhận xét",
    section: 5,
  },
  {
    value: "missing_homework",
    label: "Học viên thường xuyên không hoàn thành bài tập",
    noteLabel: "Nhận xét",
    section: 5,
  },
  {
    value: "escalate",
    label: "Học viên cần bộ phận đào tạo theo dõi hoặc liên hệ",
    noteLabel: "Lý do",
    section: 5,
  },
  {
    value: "follow_up_next",
    label: "Học viên cần theo dõi thêm",
    noteLabel: "Ghi chú",
    section: 7,
  },
] as const;

export type StudentCategory = (typeof STUDENT_CATEGORIES)[number]["value"];

/** Năm nhóm của mục 5 — mục 7 dùng riêng `follow_up_next`. */
export const SECTION_5_CATEGORIES = STUDENT_CATEGORIES.filter(
  (item) => item.section === 5,
);

/** Mục 6 — nhóm vấn đề phát sinh. */
export const ISSUE_CATEGORIES = [
  { value: "student", label: "Học viên" },
  { value: "curriculum", label: "Giáo trình / Nội dung giảng dạy" },
  { value: "teacher", label: "Giáo viên" },
  { value: "facility", label: "Thiết bị / Phòng học" },
  { value: "connection", label: "Đường truyền / Nền tảng học online" },
  { value: "schedule", label: "Lịch học / Thời lượng học" },
  { value: "other", label: "Khác" },
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["value"];

/** Mục 6 — ảnh hưởng đến buổi học. */
export const ISSUE_IMPACTS = [
  { value: "negligible", label: "Không đáng kể" },
  { value: "completed_anyway", label: "Có ảnh hưởng nhưng vẫn hoàn thành buổi học" },
  { value: "major", label: "Ảnh hưởng lớn đến chất lượng buổi học" },
] as const;

export type IssueImpact = (typeof ISSUE_IMPACTS)[number]["value"];

/**
 * Mục 6 — mức độ cần xử lý.
 *
 * `high` là giá trị làm báo cáo nổi lên bảng cảnh báo của giáo vụ. Giao diện
 * phải nói trước hệ quả đó ngay cạnh lựa chọn, đừng để giáo viên phát hiện sau.
 */
export const ISSUE_SEVERITIES = [
  { value: "low", label: "Thấp", description: "Theo dõi thêm" },
  { value: "medium", label: "Trung bình", description: "Cần bộ phận đào tạo hỗ trợ" },
  { value: "high", label: "Cao", description: "Cần xử lý ngay" },
] as const;

export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number]["value"];

/** Mục 8 — loại minh chứng. */
export const EVIDENCE_KINDS = [
  { value: "classroom_photo", label: "Hình ảnh lớp học / bảng giảng", needsFile: true },
  { value: "student_homework", label: "Bài tập của học viên", needsFile: true },
  { value: "materials", label: "Tài liệu sử dụng trong buổi học", needsFile: false },
  { value: "other", label: "Minh chứng khác nếu có", needsFile: false },
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]["value"];

/** Mục 9 — đánh giá chung về buổi học. */
export const OVERALL_RATINGS = [
  { value: "excellent", label: "Rất tốt", description: "Buổi học đạt hiệu quả cao" },
  { value: "good", label: "Tốt", description: "Đạt mục tiêu đề ra" },
  { value: "satisfactory", label: "Đạt yêu cầu", description: "Có một số nội dung cần cải thiện" },
  {
    value: "needs_improvement",
    label: "Cần cải thiện",
    description: "Có vấn đề ảnh hưởng đến kết quả học tập",
  },
  {
    value: "unsatisfactory",
    label: "Chưa đạt",
    description: "Cần bộ phận đào tạo hỗ trợ / xử lý",
  },
] as const;

export type OverallRating = (typeof OVERALL_RATINGS)[number]["value"];

/** Câu xác nhận cuối biểu mẫu — nguyên văn mẫu. */
export const CONFIRMATION_TEXT =
  "Tôi xác nhận thông tin báo cáo trên phản ánh đúng tình hình thực tế của buổi học.";

/** Tiêu đề 9 mục, dùng cho mục lục · rail · bản in. */
export const SECTION_TITLES = [
  "Thông tin buổi học",
  "Chuyên cần học viên",
  "Tiến độ giảng dạy",
  "Đánh giá kết quả buổi học",
  "Đánh giá học viên cần lưu ý",
  "Vấn đề phát sinh trong buổi học",
  "Kế hoạch cho buổi học tiếp theo",
  "Minh chứng buổi học",
  "Nhận xét tổng kết của giáo viên",
] as const;

// --- Tra cứu nhãn từ giá trị -------------------------------------------------
//
// Trả `null` khi không khớp thay vì ném lỗi: dữ liệu cũ hoặc giá trị lạ không
// được làm sập cả trang báo cáo. Chỗ gọi tự quyết hiển thị "—".

function lookup<T extends { readonly value: V; readonly label: string }, V>(
  options: readonly T[],
  value: V | null | undefined,
): T | null {
  if (value === null || value === undefined) return null;
  return options.find((option) => option.value === value) ?? null;
}

export function modeLabel(value: string | null | undefined) {
  return lookup(SESSION_REPORT_MODES, value as SessionReportMode)?.label ?? null;
}

export function planCompletionLabel(value: string | null | undefined) {
  return lookup(PLAN_COMPLETIONS, value as PlanCompletion)?.label ?? null;
}

export function homeworkCompletionLabel(value: string | null | undefined) {
  return lookup(HOMEWORK_COMPLETIONS, value as HomeworkCompletion)?.label ?? null;
}

export function issueImpactLabel(value: string | null | undefined) {
  return lookup(ISSUE_IMPACTS, value as IssueImpact)?.label ?? null;
}

export function issueSeverityOption(value: string | null | undefined) {
  return lookup(ISSUE_SEVERITIES, value as IssueSeverity);
}

export function issueCategoryLabel(value: string) {
  return lookup(ISSUE_CATEGORIES, value as IssueCategory)?.label ?? value;
}

export function evidenceKindLabel(value: string) {
  return lookup(EVIDENCE_KINDS, value as EvidenceKind)?.label ?? value;
}

export function overallRatingOption(value: string | null | undefined) {
  return lookup(OVERALL_RATINGS, value as OverallRating);
}

export function studentCategoryOption(value: string) {
  return lookup(STUDENT_CATEGORIES, value as StudentCategory);
}

export function ratingOption(
  options: readonly RatingOption[],
  value: number | null | undefined,
) {
  return lookup(options, value ?? null);
}

/**
 * Một dòng thang điểm ở dạng đọc được: `"4 — Tốt: Nắm được phần lớn nội dung"`.
 *
 * Dùng cho bản in và bản xem. Bản mẫu Word in cả 5 dòng ☐ rồi tick một dòng;
 * ở đây chỉ in dòng ĐƯỢC CHỌN kèm nguyên văn mô tả của nó — bỏ 4 dòng thừa là
 * bỏ *cách trình bày*, không bỏ *nội dung* (`D-43` điểm 3).
 */
export function ratingSentence(
  options: readonly RatingOption[],
  value: number | null | undefined,
): string | null {
  const option = ratingOption(options, value);
  if (!option) return null;
  return option.description
    ? `${option.value} — ${option.label}: ${option.description}`
    : `${option.value} — ${option.label}`;
}
