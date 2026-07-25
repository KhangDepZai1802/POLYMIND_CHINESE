import "server-only";

import { z } from "zod";

import { FLASHCARD_MEDIA_BUCKET } from "@/features/flashcards/domain/media";
import { normalizeFlashcardPublicToken } from "@/features/flashcards/domain/public-link";
import { attachSignedMedia } from "@/features/flashcards/server/queries";
import { createPublicClient } from "@/lib/supabase/public-client";
import { signPaths } from "@/lib/supabase/signed-urls";

/**
 * Đường đọc của trang CÔNG KHAI `/t/<mã>` — học sinh quét mã QR trong sách.
 *
 * Không đăng nhập, không phân quyền, chỉ đọc. Toàn bộ luật "được xem hay không"
 * nằm trong RPC `public.get_public_flashcard_session` (migration `…080`), không
 * lặp lại ở đây: lặp lại là tạo nguồn sự thật thứ hai (`BUG_M10_01`).
 */

/**
 * Payload từ DB chỉ đi qua đúng cái van này.
 *
 * DB đã fail-closed rồi, nhưng `rpc()` trả `Json` nên nếu không parse thì mọi
 * trường đều là `any` khi đi vào React — một lần đổi tên cột ở SQL sẽ thành
 * `undefined` lặng lẽ trên màn học sinh thay vì lỗi build.
 */
const publicPageSchema = z.object({
  order_index: z.number().int(),
  kind: z.enum(["session_cover", "vocabulary"]),
  hanzi: z.string().nullable(),
  pinyin_syllables: z.string().nullable(),
  meaning_vi: z.string().nullable(),
  front_image_path: z.string().nullable(),
  back_image_path: z.string().nullable(),
  audio_path: z.string().nullable(),
  front_alt: z.string().nullable(),
  back_alt: z.string().nullable(),
  example_sentences: z.unknown(),
  common_phrases: z.unknown(),
  media_paths: z.array(z.string()),
});

const publicSessionSchema = z.object({
  section: z.object({
    session_number: z.number().int(),
    title: z.string(),
    deck_title: z.string(),
    course_title: z.string(),
  }),
  pages: z.array(publicPageSchema),
});

type PublicSessionPayload = z.infer<typeof publicSessionSchema>;

export type PublicFlashcardPageView = PublicSessionPayload["pages"][number] & {
  frontUrl: string | null;
  backUrl: string | null;
  audioUrl: string | null;
  mediaUrls: Record<string, string>;
};

export type PublicFlashcardSectionView = {
  section: PublicSessionPayload["section"];
  pages: PublicFlashcardPageView[];
};

/** Đủ dài cho một lượt học, bằng đúng đường học viên (`queries.ts`). */
const SIGNED_URL_TTL_SECONDS = 900;

/**
 * ⛔ CỐ Ý KHÔNG CACHE — đọc thẳng DB mỗi lượt xem.
 *
 * Bản thiết kế ban đầu định bọc `unstable_cache` 5 phút để chặn tải xuống DB.
 * Bỏ đi vì **thu hồi**: cache 5 phút nghĩa là mã QR vừa bị gỡ vẫn mở ra nội
 * dung thêm 5 phút nữa. Next 16 đổi chữ ký `revalidateTag(tag, profile)` và
 * ngữ nghĩa của tham số thứ hai chưa xác minh được ở đây — đoán sai trên đúng
 * đường thu hồi thì cái hỏng là một bảo đảm bảo mật, không phải một con số
 * hiệu năng.
 *
 * Đổi lại: mỗi lượt quét là một câu truy vấn. Nó rẻ (tra `ux_..._token` rồi
 * join theo khoá chính) và trang đã có `Cache-Control: no-store` nên CDN cũng
 * không giữ bản cũ. Nếu về sau lưu lượng thật đủ lớn để cần cache, hãy đo
 * trước rồi mới thêm, và phải có bài E2E chứng minh thu hồi vẫn tức thì.
 */

async function fetchPublicSession(
  token: string,
): Promise<PublicSessionPayload | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_flashcard_session", {
    p_token: token,
  });

  // Fail-closed: lỗi mạng/lỗi quyền đều dẫn tới "không có trang này", không bao
  // giờ rò lý do ra ngoài.
  if (error || data === null) return null;

  const parsed = publicSessionSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getPublicFlashcardSection(
  rawToken: unknown,
): Promise<PublicFlashcardSectionView | null> {
  // Mã sai hình dạng dừng NGAY, không chạm DB. Đây cũng là lớp chắn rẻ nhất
  // trước việc dò mã hàng loạt.
  const token = normalizeFlashcardPublicToken(rawToken);
  if (!token) return null;

  const payload = await fetchPublicSession(token);
  if (!payload) return null;

  const supabase = createPublicClient();
  const signed = await signPaths(
    supabase,
    FLASHCARD_MEDIA_BUCKET,
    [...new Set(payload.pages.flatMap((page) => page.media_paths))],
    SIGNED_URL_TTL_SECONDS,
  );

  return {
    section: payload.section,
    pages: payload.pages.map((page) => attachSignedMedia(page, signed)),
  };
}
