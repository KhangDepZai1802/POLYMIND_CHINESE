import type { Database } from "@/types/database";

export type EnrollmentStatus =
  Database["public"]["Enums"]["enrollment_status"];

/**
 * Vòng đời ghi danh — luật nghiệp vụ thuần, không đụng DB, có unit test.
 *
 * Đây KHÔNG phải lớp phân quyền và cũng KHÔNG phải chốt chặn cuối. RPC
 * (`change_enrollment_status`, `transfer_enrollment`) mới là nơi cưỡng chế thật:
 * chúng khóa hàng, chặn trạng thái cuối, và ghi history trong cùng transaction.
 * File này để UI biết nên hiện nút gì, và để luật được viết ra một chỗ thay vì
 * rải rác trong JSX.
 */

/** Đang mở = còn chiếm một chỗ trong lớp, và tính vào ràng buộc D-18. */
export const OPEN_ENROLLMENT_STATUSES = [
  "pending",
  "active",
  "paused",
] as const satisfies readonly EnrollmentStatus[];

/** Đã đóng — không đổi được nữa, và KHÔNG tính vào D-18. */
export const TERMINAL_ENROLLMENT_STATUSES = [
  "completed",
  "withdrawn",
  "transferred",
] as const satisfies readonly EnrollmentStatus[];

export function isOpenEnrollment(status: EnrollmentStatus): boolean {
  return (OPEN_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

export function isTerminalEnrollment(status: EnrollmentStatus): boolean {
  return (TERMINAL_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Các trạng thái đi tiếp được từ trạng thái hiện tại.
 *
 * **Fail-closed:** không có nhánh mặc định trả về "cho phép tất". Trạng thái lạ
 * → mảng rỗng → UI không hiện nút nào. Hệ cũ từng dính đúng bug ngược lại
 * (`MessagingPolicy.CanMessage` fallback `return true` → nhắn loạn xạ).
 */
export function allowedEnrollmentTransitions(
  status: EnrollmentStatus,
): EnrollmentStatus[] {
  switch (status) {
    // Chờ xếp lớp: vào học, hoặc rút trước khi học.
    case "pending":
      return ["active", "withdrawn"];

    // Đang học: tạm dừng, hoàn thành, hoặc rút.
    case "active":
      return ["paused", "completed", "withdrawn"];

    // Tạm dừng: học lại, hoàn thành (đã đủ điều kiện), hoặc rút hẳn.
    case "paused":
      return ["active", "completed", "withdrawn"];

    // Trạng thái cuối — không đi đâu được nữa. Muốn học lại thì ghi danh mới.
    case "completed":
    case "withdrawn":
    case "transferred":
      return [];

    // Enum có giá trị mới mà quên khai ở đây → KHÔNG cho làm gì. Thà UI thiếu
    // nút còn hơn cho phép một chuyển đổi chưa ai nghĩ tới.
    default:
      return [];
  }
}

/** Chỉ chuyển lớp được khi ghi danh còn mở. */
export function canTransferEnrollment(status: EnrollmentStatus): boolean {
  return isOpenEnrollment(status);
}

/** Nhãn hành động (động từ) — khác với nhãn trạng thái (danh từ). */
export const ENROLLMENT_ACTION_LABELS: Record<EnrollmentStatus, string> = {
  pending: "Chuyển về chờ xếp lớp",
  active: "Cho vào học",
  paused: "Tạm dừng",
  completed: "Xác nhận hoàn thành",
  withdrawn: "Rút học",
  transferred: "Chuyển lớp",
};
