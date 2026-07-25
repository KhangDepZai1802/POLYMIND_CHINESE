"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorToMessage, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Tạo / thu hồi liên kết công khai cho mã QR in trong sách (`D-36`).
 *
 * Tách khỏi `actions.ts` cố ý: file này là bề mặt quản trị của tính năng công
 * khai, và `tests/unit/security/public-surface-imports.test.ts` cần soi riêng
 * nó. Gộp vào `actions.ts` (hơn 1000 dòng, 16 action) thì bài kiểm tĩnh không
 * còn phân biệt được cái gì thuộc bề mặt công khai nữa.
 *
 * Cả hai action chỉ gọi RPC `security definer`; kiểm quyền thật nằm trong RPC
 * (`app.is_super_admin()`), `requireRole` ở đây chỉ là chặn sớm cho đẹp.
 */

const FLASHCARD_PATH = "/admin/flashcards";

const sectionIdSchema = z.object({ sectionId: z.uuid() });
const linkSchema = z.object({ linkId: z.uuid(), token: z.string() });

export async function createFlashcardPublicLinkAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = sectionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Buổi flashcard không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_flashcard_public_link", {
    p_section_id: parsed.data.sectionId,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không tạo được liên kết.") };
  }

  revalidatePath(FLASHCARD_PATH);
  return { success: "Đã tạo liên kết công khai." };
}

export async function revokeFlashcardPublicLinkAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = linkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Liên kết không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_flashcard_public_link", {
    p_link_id: parsed.data.linkId,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không thu hồi được liên kết.") };
  }

  // Trang công khai đọc thẳng DB (xem ghi chú trong `public-queries.ts`) nên
  // không có cache nào phải xoá — thu hồi có hiệu lực ngay ở lượt quét kế tiếp.
  revalidatePath(FLASHCARD_PATH);
  return { success: "Đã thu hồi liên kết công khai." };
}
