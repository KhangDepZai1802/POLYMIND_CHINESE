import { z } from "zod";

const optionalLocalDateTime = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    { message: "Thời điểm hết hạn không hợp lệ" },
  )
  .transform((value) => (value === "" ? null : value));

export const announcementSchema = z.object({
  announcement_id: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.string().uuid().safeParse(value).success,
      {
        message: "Mã announcement không hợp lệ",
      },
    )
    .transform((value) => (value === "" ? null : value)),
  title: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập tiêu đề" })
    .max(200, { message: "Tiêu đề tối đa 200 ký tự" }),
  body: z
    .string()
    .trim()
    .min(1, { message: "Vui lòng nhập nội dung" })
    .max(5000, { message: "Nội dung tối đa 5000 ký tự" }),
  class_id: z
    .string()
    .trim()
    .refine(
      (value) => value === "all" || z.string().uuid().safeParse(value).success,
      { message: "Phạm vi lớp không hợp lệ" },
    )
    .transform((value) => (value === "all" ? null : value)),
  expires_at: optionalLocalDateTime,
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;
