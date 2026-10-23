import { z } from "zod";

export const B2C_PERMISSION_LABELS = {
  manage_center_student_data: "Bổ sung nguồn khách, SĐT và thông tin ghi danh toàn trung tâm",
  manage_center_tuition: "Nhập gói học phí và phiếu thu cho toàn trung tâm",
  manage_admissions: "Nhập khách tiềm năng, tư vấn và cập nhật tuyển sinh",
  view_classes: "Xem các lớp được phân công",
  view_students: "Xem danh sách học viên",
  view_assessments: "Xem kiểm tra giữa kỳ / cuối kỳ",
  grade_assessments: "Tạo bài kiểm tra và nhập điểm",
  view_schedule: "Xem lịch học của lớp",
  view_comments: "Xem nhận xét học viên",
  write_comments: "Nhập nhận xét học viên",
  share_monthly_comments: "Chuẩn bị gửi và ghi nhận gửi nhận xét tháng cho phụ huynh",
  mark_attendance: "Điểm danh học viên",
  check_teaching: "Chấm công buổi dạy của mình",
  view_pay: "Xem giờ dạy, đơn giá và tiền công của mình",
  create_classes: "Tạo lớp mới và tự phân công",
  edit_classes: "Sửa thông tin lớp được phân công",
  edit_schedule: "Tạo/sửa lịch học của lớp",
  edit_students: "Sửa hồ sơ học viên trong lớp",
  view_tuition: "Xem học phí và phiếu thu của lớp",
  collect_tuition: "Thu học phí, lập phiếu thu",
  edit_tuition: "Tạo/sửa gói học phí",
} as const;
export type B2CPermission = keyof typeof B2C_PERMISSION_LABELS;
export const B2C_PERMISSION_KEYS = Object.keys(
  B2C_PERMISSION_LABELS,
) as B2CPermission[];
export const DEFAULT_B2C_PERMISSIONS: B2CPermission[] = [
  "view_classes",
  "view_students",
  "view_schedule",
  "view_comments",
  "check_teaching",
  "view_pay",
];
export const B2C_PERMISSION_DEPENDENCIES: Partial<
  Record<B2CPermission, B2CPermission[]>
> = {
  manage_center_tuition: ["view_tuition", "edit_tuition", "collect_tuition"],
  view_students: ["view_classes"],
  view_assessments: ["view_students"],
  grade_assessments: ["view_assessments"],
  view_schedule: ["view_classes"],
  view_comments: ["view_classes"],
  write_comments: ["view_comments", "view_students"],
  share_monthly_comments: ["write_comments"],
  mark_attendance: ["view_students", "view_schedule"],
  create_classes: ["view_classes"],
  edit_classes: ["view_classes"],
  edit_schedule: ["view_schedule"],
  edit_students: ["view_students"],
  view_tuition: ["view_classes"],
  collect_tuition: ["view_tuition"],
  edit_tuition: ["view_tuition"],
};
export function toggleB2CPermission(
  current: B2CPermission[],
  key: B2CPermission,
  enabled: boolean,
): B2CPermission[] {
  const selected = new Set(current);
  function add(value: B2CPermission) {
    selected.add(value);
    B2C_PERMISSION_DEPENDENCIES[value]?.forEach(add);
  }
  if (enabled) add(key);
  else {
    selected.delete(key);
    for (let i = 0; i < B2C_PERMISSION_KEYS.length; i++) {
      for (const value of selected)
        if (
          B2C_PERMISSION_DEPENDENCIES[value]?.some(
            (dependency) => !selected.has(dependency),
          )
        )
          selected.delete(value);
    }
  }
  return B2C_PERMISSION_KEYS.filter((value) => selected.has(value));
}
export const teacherPermissionsSchema = z
  .object({
    teacher_id: z.uuid(),
    source_teacher_id: z.uuid(),
    permissions: z
      .array(z.enum(B2C_PERMISSION_KEYS as [B2CPermission, ...B2CPermission[]]))
      .max(B2C_PERMISSION_KEYS.length),
    expected_updated_at: z.string().nullable(),
  })
  .refine(
    (value) =>
      value.permissions.every(
        (key) =>
          B2C_PERMISSION_DEPENDENCIES[key]?.every((dependency) =>
            value.permissions.includes(dependency),
          ) ?? true,
      ),
    { message: "Chọn đầy đủ quyền xem liên quan trước khi cấp quyền sửa." },
  );
