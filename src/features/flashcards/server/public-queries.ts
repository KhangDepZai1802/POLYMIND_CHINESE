import "server-only";

import { unstable_cache } from "next/cache";
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
 * Cache **DỮ LIỆU**, không cache HTML.
 *
 * Trang dùng `force-dynamic` nên URL đã ký được sinh lại cho mỗi lượt xem —
 * nếu cache cả HTML thì trang cũ sẽ phục vụ URL đã hết hạn, ảnh và audio hỏng
 * theo đồng hồ. Cache riêng phần đọc DB thì một mã QR chỉ chạm DB ~1 lần/5 phút
 * dù cả lớp cùng quét.
 *
 * Tag theo mã để **thu hồi có hiệu lực tức thì** (`revalidateTag` trong
 * `public-link-actions.ts`), không phải chờ hết 5 phút.
 */
export function publicFlashcardCacheTag(token: string) {
  return `public-flashcard:${token}`;
}

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

  const payload = await unstable_cache(
    () => fetchPublicSession(token),
    ["public-flashcard-session", token],
    { revalidate: 300, tags: [publicFlashcardCacheTag(token)] },
  )();

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
