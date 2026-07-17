import { describe, expect, it } from "vitest";

import { courseSchema } from "@/features/courses/schema";

const BASE = {
  title: "Tiếng Trung giao tiếp cơ bản",
  title_en: "",
  level_id: "none",
  target_audience: "",
  objectives: "",
  description: "",
  default_session_count: "",
  default_session_duration_minutes: "",
  default_tuition_amount: "",
  completion_min_attendance_rate: "80",
  completion_min_overall_score: "50",
  completion_require_all_exercises: false,
  status: "draft",
};

describe("courseSchema — chương trình và loại", () => {
  it.each(["hsk", "communication", "kids", "exam_prep", "custom"])(
    "chấp nhận loại %s cho chương trình cốt lõi",
    (courseType) => {
      const parsed = courseSchema.safeParse({
        ...BASE,
        program: "core",
        course_type: courseType,
      });

      expect(parsed.success).toBe(true);
      expect(parsed.data?.course_type).toBe(courseType);
    },
  );

  it("từ chối chương trình cốt lõi chưa chọn loại", () => {
    const parsed = courseSchema.safeParse({ ...BASE, program: "core" });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["course_type"]);
  });

  it("chương trình doanh nghiệp luôn chuẩn hóa loại về rỗng", () => {
    const parsed = courseSchema.safeParse({
      ...BASE,
      program: "business",
      course_type: "custom",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.course_type).toBeNull();
  });

  it("không nhận mã khóa học từ form", () => {
    const parsed = courseSchema.safeParse({
      ...BASE,
      program: "core",
      course_type: "hsk",
      code: "MA-NGUOI-DUNG-NHAP",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("code");
  });
});
