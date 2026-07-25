import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFlashcardReader } from "@/features/flashcards/components/public-flashcard-reader";
import { getPublicFlashcardSection } from "@/features/flashcards/server/public-queries";

/**
 * Trang flashcard CÔNG KHAI — đích đến của mã QR in trong sách giáo khoa.
 *
 * Không đăng nhập, không phân quyền, chỉ đọc (`D-36`).
 */

/**
 * KHÔNG cache HTML.
 *
 * Lý do quyết định là **thu hồi**, không phải hiệu năng: trang đã cache vẫn
 * phục vụ nội dung sau khi admin bấm "Thu hồi" — mã QR chết trên giấy nhưng
 * web vẫn chạy. Phụ nữa: HTML cache sẽ giữ luôn URL media đã ký, mà URL hết
 * hạn theo đồng hồ.
 *
 * Tải xuống DB vẫn được chặn — phần đọc DB có cache riêng 5 phút trong
 * `public-queries.ts`, còn URL thì ký mới cho từng lượt xem.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flashcard",
  // Mã QR là đường vào, KHÔNG phải để Google dò ra. Lớp thứ hai nằm ở
  // `src/app/robots.ts` và header trong `next.config.ts`.
  robots: { index: false, follow: false },
};

export default async function PublicFlashcardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicFlashcardSection(token);

  // Một `notFound()` cho mọi ca hỏng — xem ghi chú ở `(public)/not-found.tsx`.
  if (!data) notFound();

  return <PublicFlashcardReader data={data} />;
}
