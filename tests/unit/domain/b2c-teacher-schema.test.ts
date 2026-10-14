import { describe, expect, it } from "vitest";
import { b2cTeacherSchema } from "@/features/b2c/teacher-schema";
import { B2C_NAVIGATION } from "@/lib/permissions/navigation";
const teacher = {
  id: "",
  full_name: "Cô Tú",
  phone: "0901234567",
  email: "tu@example.com",
  specialization: "Tiếng Anh",
  employment_type: "part_time",
  hourly_rate: "150000",
};
describe("hồ sơ giáo viên B2C", () => {
  it("có lối vào trong menu B2C", () => {
    expect(B2C_NAVIGATION).toContainEqual(
      expect.objectContaining({
        label: "Giáo viên",
        href: "/admin/b2c/teachers",
      }),
    );
  });
  it("lưu hồ sơ không cần tài khoản", () => {
    expect(b2cTeacherSchema.parse(teacher)).toMatchObject({
      full_name: "Cô Tú",
      employment_type: "part_time",
      hourly_rate: 150000,
    });
  });
  it("cho phép liên hệ trống và đơn giá 0", () => {
    expect(
      b2cTeacherSchema.parse({
        ...teacher,
        phone: "",
        email: "",
        hourly_rate: "0",
      }),
    ).toMatchObject({ phone: null, email: null, hourly_rate: 0 });
  });
  it.each(["", "-1", "1.5", "abc", "1000000000000"])(
    "chặn đơn giá %s",
    (hourly_rate) => {
      expect(
        b2cTeacherSchema.safeParse({ ...teacher, hourly_rate }).success,
      ).toBe(false);
    },
  );
  it("chặn email sai và hình thức ngoài danh mục", () => {
    expect(
      b2cTeacherSchema.safeParse({ ...teacher, email: "bad" }).success,
    ).toBe(false);
    expect(
      b2cTeacherSchema.safeParse({ ...teacher, employment_type: "other" })
        .success,
    ).toBe(false);
  });
});
