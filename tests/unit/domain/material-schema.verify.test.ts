import { describe, expect, it } from "vitest";

import { materialRegisterSchema } from "@/features/courses/schema";

/**
 * Xác minh độc lập BUG-M06-001 (Claude, không dùng lại test của Codex).
 *
 * Lỗi gốc: upload tài liệu ở cấp **Cả khóa học** — form không có module/lesson nên
 * không gửi field nào cả. Schema cũ không nhận `undefined` → metadata bị từ chối
 * SAU KHI file đã lên Storage → object mồ côi + người dùng thấy "lỗi validation"
 * mà không hiểu vì sao.
 */
describe("BUG-M06-001 — materialRegisterSchema ở cấp khóa học", () => {
  const base = {
    course_id: "11111111-1111-4111-8111-111111111111",
    object_path: "11111111-1111-4111-8111-111111111111/abc.pdf",
    title: "Giáo trình tổng quan",
    visibility: "enrolled_students",
  };

  it("chấp nhận khi module_id/lesson_id KHÔNG được gửi (đúng ca gây bug)", () => {
    const parsed = materialRegisterSchema.safeParse(base);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.module_id).toBeNull();
    expect(parsed.data?.lesson_id).toBeNull();
  });

  it("map chuỗi rỗng và 'none' của Select về null", () => {
    const parsed = materialRegisterSchema.safeParse({
      ...base,
      module_id: "",
      lesson_id: "none",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.module_id).toBeNull();
    expect(parsed.data?.lesson_id).toBeNull();
  });

  it("vẫn từ chối uuid rác — nới lỏng không có nghĩa là hết kiểm", () => {
    const parsed = materialRegisterSchema.safeParse({
      ...base,
      module_id: "khong-phai-uuid",
    });

    expect(parsed.success).toBe(false);
  });

  it("giữ nguyên uuid hợp lệ khi gắn vào bài học cụ thể", () => {
    const lessonId = "22222222-2222-4222-8222-222222222222";
    const parsed = materialRegisterSchema.safeParse({
      ...base,
      lesson_id: lessonId,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.lesson_id).toBe(lessonId);
  });
});
