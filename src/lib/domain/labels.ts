import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

/**
 * Nhãn tiếng Việt cho enum DB.
 *
 * Tập trung ở một chỗ để không có chuyện cùng một `enrollment_status` mà màn
 * hình này gọi "Đang học", màn hình kia gọi "Hoạt động".
 *
 * `Record<Enums[...], string>` bắt buộc phải phủ ĐỦ mọi giá trị enum → thêm giá
 * trị mới vào DB mà quên dịch thì TypeScript báo lỗi ngay, không đợi ra production.
 */

export const COURSE_TYPE_LABELS: Record<Enums["course_type"], string> = {
  hsk: "HSK",
  communication: "Giao tiếp",
  kids: "Thiếu nhi",
  exam_prep: "Luyện thi",
  custom: "Tùy chỉnh",
};

export const CORE_COURSE_TYPE_LABELS = COURSE_TYPE_LABELS;

export const COURSE_PROGRAM_LABELS: Record<Enums["course_program"], string> = {
  core: "Chương trình cốt lõi",
  business: "Chương trình doanh nghiệp",
};

export const COURSE_STATUS_LABELS: Record<Enums["course_status"], string> = {
  draft: "Nháp",
  active: "Đang mở",
  archived: "Lưu trữ",
};

export const CLASS_STATUS_LABELS: Record<Enums["class_status"], string> = {
  planned: "Sắp mở",
  active: "Đang học",
  paused: "Tạm dừng",
  completed: "Đã kết thúc",
  cancelled: "Đã hủy",
};

export const DELIVERY_MODE_LABELS: Record<Enums["delivery_mode"], string> = {
  offline: "Tại trung tâm",
  online: "Trực tuyến",
  hybrid: "Kết hợp",
  in_house: "Tại doanh nghiệp",
};

export const SESSION_STATUS_LABELS: Record<Enums["session_status"], string> = {
  scheduled: "Đã lên lịch",
  completed: "Đã dạy",
  cancelled: "Đã hủy",
  rescheduled: "Đã đổi lịch",
};

export const ENROLLMENT_STATUS_LABELS: Record<
  Enums["enrollment_status"],
  string
> = {
  pending: "Chờ xếp lớp",
  active: "Đang học",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
  withdrawn: "Đã rút",
  transferred: "Đã chuyển lớp",
};

export const ATTENDANCE_STATUS_LABELS: Record<
  Enums["attendance_status"],
  string
> = {
  present: "Có mặt",
  late: "Đi muộn",
  absent: "Vắng",
  excused: "Có phép",
};

export const LESSON_PROGRESS_LABELS: Record<
  Enums["lesson_progress_status"],
  string
> = {
  not_started: "Chưa học",
  in_progress: "Đang học",
  completed: "Đã hoàn thành",
};

export const ASSESSMENT_TYPE_LABELS: Record<Enums["assessment_type"], string> =
  {
    quiz: "Kiểm tra nhanh",
    midterm: "Giữa kỳ",
    final: "Cuối kỳ",
    mock_hsk: "Thi thử HSK",
    speaking: "Kiểm tra nói",
    custom: "Khác",
  };

export const EVALUATION_RATING_LABELS: Record<
  Enums["evaluation_rating"],
  string
> = {
  weak: "Yếu",
  average: "Trung bình",
  good: "Khá",
  excellent: "Tốt",
};

export const NOTE_VISIBILITY_LABELS: Record<Enums["note_visibility"], string> =
  {
    staff_only: "Nội bộ (học viên không thấy)",
    student_visible: "Học viên xem được",
  };

export const MATERIAL_VISIBILITY_LABELS: Record<
  Enums["material_visibility"],
  string
> = {
  staff_only: "Nội bộ",
  enrolled_students: "Học viên trong lớp",
};

export const INVOICE_STATUS_LABELS: Record<Enums["invoice_status"], string> = {
  draft: "Nháp",
  issued: "Đã phát hành",
  partial: "Đã thu một phần",
  paid: "Đã thanh toán",
  overdue: "Quá hạn",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};

export const PAYMENT_METHOD_LABELS: Record<Enums["payment_method"], string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Thẻ",
  e_wallet: "Ví điện tử",
  other: "Khác",
};

export const NOTIFICATION_TYPE_LABELS: Record<
  Enums["notification_type"],
  string
> = {
  session_upcoming: "Buổi học sắp tới",
  session_changed: "Buổi học thay đổi",
  assignment_new: "Bài tập mới",
  assignment_due: "Bài tập sắp hết hạn",
  assessment_upcoming: "Bài kiểm tra sắp tới",
  result_published: "Kết quả đã công bố",
  attendance_absent: "Vắng học",
  invoice_new: "Hóa đơn mới",
  invoice_due: "Học phí sắp đến hạn",
  invoice_overdue: "Học phí quá hạn",
  announcement: "Thông báo chung",
  exercise_assigned: "Bài tập mới",
  exercise_returned: "Bài tập được trả lại",
  exercise_result_published: "Kết quả bài tập",
  exam_scheduled: "Lịch kiểm tra/thi",
  exam_opening: "Kỳ thi sắp mở",
  exam_result_published: "Kết quả kiểm tra/thi",
};

/**
 * Màu badge theo trạng thái.
 *
 * ⚠️ Màu KHÔNG BAO GIỜ là tín hiệu duy nhất (WCAG). Badge luôn kèm CHỮ —
 * người mù màu vẫn phải đọc được trạng thái.
 */
export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export const CLASS_STATUS_TONE: Record<Enums["class_status"], BadgeTone> = {
  planned: "info",
  active: "success",
  paused: "warning",
  completed: "neutral",
  cancelled: "danger",
};

export const ENROLLMENT_STATUS_TONE: Record<
  Enums["enrollment_status"],
  BadgeTone
> = {
  pending: "info",
  active: "success",
  paused: "warning",
  completed: "neutral",
  withdrawn: "danger",
  transferred: "neutral",
};

export const ATTENDANCE_STATUS_TONE: Record<
  Enums["attendance_status"],
  BadgeTone
> = {
  present: "success",
  late: "warning",
  absent: "danger",
  excused: "info",
};

export const SESSION_STATUS_TONE: Record<Enums["session_status"], BadgeTone> = {
  scheduled: "info",
  completed: "success",
  cancelled: "danger",
  rescheduled: "warning",
};

export const COURSE_STATUS_TONE: Record<Enums["course_status"], BadgeTone> = {
  draft: "neutral",
  active: "success",
  archived: "neutral",
};

export const INVOICE_STATUS_TONE: Record<Enums["invoice_status"], BadgeTone> = {
  draft: "neutral",
  issued: "info",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  cancelled: "neutral",
  refunded: "neutral",
};
