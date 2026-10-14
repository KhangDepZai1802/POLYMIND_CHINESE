import { describe, expect, it } from "vitest";
import { teacherUpdateSchema } from "@/features/teachers/schema";

const profile = {
  id: "8954b8f8-6ef1-4958-a790-f137ef91546f",
  full_name: "Giáo viên A",
  phone: "",
  specialization: "Tiếng Anh",
  bio: "",
  employment_type: "part_time",
  hourly_rate: "150000",
};
describe("hồ sơ giáo viên", () => {
  it("lưu đúng hình thức và đơn giá VNĐ/giờ", () => {
    expect(teacherUpdateSchema.parse(profile)).toMatchObject({
      employment_type: "part_time",
      hourly_rate: 150000,
    });
  });
  it("phân biệt chưa nhập và đơn giá 0", () => {
    expect(
      teacherUpdateSchema.parse({
        ...profile,
        employment_type: "",
        hourly_rate: "",
      }),
    ).toMatchObject({ employment_type: null, hourly_rate: null });
    expect(
      teacherUpdateSchema.parse({ ...profile, hourly_rate: "0" }).hourly_rate,
    ).toBe(0);
  });
  it.each(["-1", "1.5", "abc", "1000000000000"])(
    "chặn đơn giá không hợp lệ %s",
    (hourly_rate) => {
      expect(
        teacherUpdateSchema.safeParse({ ...profile, hourly_rate }).success,
      ).toBe(false);
    },
  );
  it("chặn hình thức ngoài danh mục", () => {
    expect(
      teacherUpdateSchema.safeParse({ ...profile, employment_type: "other" })
        .success,
    ).toBe(false);
  });
});
