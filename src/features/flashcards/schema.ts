import { z } from "zod";

export const flashcardDeckSchema = z.object({
  course_id: z.uuid("Khóa học không hợp lệ."),
  title: z.string().trim().min(2, "Nhập tên bộ flashcard.").max(120),
  description: z.string().trim().max(500).optional().default(""),
});

export const flashcardSectionSchema = z.object({
  id: z.uuid().optional(),
  deck_id: z.uuid("Bộ flashcard không hợp lệ."),
  session_number: z.coerce.number().int().positive("Số buổi phải lớn hơn 0."),
  title: z.string().trim().min(2, "Nhập tên buổi.").max(120),
});

export const flashcardPageSchema = z
  .object({
    id: z.uuid("Trang flashcard không hợp lệ."),
    section_id: z.uuid("Buổi flashcard không hợp lệ."),
    kind: z.enum(["session_cover", "vocabulary"]),
    term: z.string().trim().max(120).optional().default(""),
    front_alt: z.string().trim().min(2, "Nhập mô tả ảnh mặt trước.").max(240),
    back_alt: z.string().trim().min(2, "Nhập mô tả ảnh mặt sau.").max(240),
    front_image_path: z.string().trim().min(1),
    back_image_path: z.string().trim().min(1),
    audio_path: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "vocabulary" && !value.term) {
      ctx.addIssue({
        code: "custom",
        path: ["term"],
        message: "Trang từ vựng cần nhập từ/cụm từ.",
      });
    }
  });

export const flashcardUploadRequestSchema = z.object({
  sectionId: z.uuid(),
  pageId: z.uuid().optional(),
  files: z
    .array(
      z.object({
        slot: z.enum(["front", "back", "audio"]),
        fileName: z.string().min(1),
        mimeType: z.string(),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(3),
});
