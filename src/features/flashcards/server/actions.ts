"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  exampleMediaSlot,
  FLASHCARD_MEDIA_BUCKET,
  flashcardAltText,
  flashcardMediaFormat,
  flashcardMediaSizeLimit,
  flashcardMediaSlotFromFileName,
  isOwnedFlashcardMediaPath,
  MAX_FLASHCARD_UPLOAD_FILES,
  type FlashcardMediaSlot,
} from "@/features/flashcards/domain/media";
import { MAX_FLASHCARD_IMPORT_ROWS } from "@/features/flashcards/domain/bulk-import";
import {
  classifyUploadedFlashcardMedia,
  type UploadedMediaCheck,
} from "@/features/flashcards/domain/bulk-media";
import {
  flashcardBulkUploadRequestSchema,
  flashcardDeckCoverAssignmentSchema,
  flashcardDeckCoverUploadRequestSchema,
  flashcardDeckSchema,
  flashcardImportRowSchema,
  flashcardMediaAssignmentSchema,
  flashcardPageSchema,
  flashcardSectionSchema,
  flashcardUploadRequestSchema,
  type FlashcardPageInput,
} from "@/features/flashcards/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

const FLASHCARD_PATH = "/admin/flashcards";

/**
 * Bao nhiêu chữ ký tải lên xin cùng lúc. Đủ để không phải chờ 34 round-trip nối
 * đuôi, vẫn đủ thấp để không mở một nắm kết nối tới Storage cùng lúc.
 */
const SIGN_CONCURRENCY = 8;

function revalidateFlashcards() {
  revalidatePath(FLASHCARD_PATH);
  revalidatePath("/student/review");
}

/**
 * Tạo HOẶC sửa một bộ thẻ (`MULTIDECK-1d`).
 *
 * Một action cho cả hai đường vì chúng ghi vào cùng một bảng với cùng ràng
 * buộc — tách đôi là đúng hình dạng `BUG_M10_01` (hai đường ghi cho một hành
 * động, rồi lệch nhau ở chỗ không ai nhìn).
 *
 * ⚠️ Đổi mã bộ khi bộ còn liên kết công khai sống bị **DB** từ chối
 * (`trg_flashcard_decks_guard_code`, `…083`). Ở đây không kiểm lại: kiểm hai
 * nơi thì nơi nào cũng có thể lệch, mà nơi ở app thì đường ghi thứ ba đi vòng
 * qua được. `dbErrorToMessage` đưa nguyên câu tiếng Việt của DB ra giao diện.
 */
export async function saveFlashcardDeckAction(
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardDeckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  if (parsed.data.id) {
    const { data: before } = await supabase
      .from("flashcard_decks")
      .select("id,code,title,description")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (!before) return { error: "Không tìm thấy bộ flashcard." };

    const { data, error } = await supabase
      .from("flashcard_decks")
      .update({
        code: parsed.data.code,
        title: parsed.data.title,
        description: parsed.data.description || null,
      })
      .eq("id", parsed.data.id)
      // Khoá theo cả khoá học: id đi qua `FormData` nên phải chặn việc sửa bộ
      // của khoá khác bằng cách đổi một trường ẩn.
      .eq("course_id", parsed.data.course_id)
      .select("id,code,title,course_id")
      .maybeSingle();

    if (error || !data) {
      return {
        error: dbErrorToMessage(error, "Không lưu được bộ flashcard."),
      };
    }

    await logAudit(supabase, {
      action: "flashcard.deck.update",
      resourceType: "flashcard_deck",
      resourceId: data.id,
      before: { code: before.code, title: before.title },
      after: { code: data.code, title: data.title },
    });
    revalidateFlashcards();
    return { success: "Đã lưu bộ flashcard." };
  }

  const { data, error } = await supabase
    .from("flashcard_decks")
    .insert({
      course_id: parsed.data.course_id,
      code: parsed.data.code,
      title: parsed.data.title,
      description: parsed.data.description || null,
      created_by: actor.id,
    })
    .select("id,code,title,course_id")
    .single();

  if (error || !data) {
    return {
      error: dbErrorToMessage(error, "Không tạo được bộ flashcard."),
    };
  }

  await logAudit(supabase, {
    action: "flashcard.deck.create",
    resourceType: "flashcard_deck",
    resourceId: data.id,
    after: { code: data.code, title: data.title, course_id: data.course_id },
  });
  revalidateFlashcards();
  return { success: "Đã tạo bộ flashcard." };
}

export async function saveFlashcardSectionAction(
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardSectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: deck } = await supabase
    .from("flashcard_decks")
    .select("id,course:courses(default_session_count)")
    .eq("id", parsed.data.deck_id)
    .maybeSingle();
  if (!deck) return { error: "Không tìm thấy bộ flashcard." };
  if (!deck.course?.default_session_count) {
    return { error: "Khóa học cần chốt số buổi trước khi thêm flashcard." };
  }
  if (parsed.data.session_number > deck.course.default_session_count) {
    return {
      error: `Khóa học chỉ có ${deck.course.default_session_count} buổi.`,
    };
  }

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("flashcard_sections")
      .update({
        session_number: parsed.data.session_number,
        title: parsed.data.title,
      })
      .eq("id", parsed.data.id)
      .eq("deck_id", parsed.data.deck_id)
      .is("archived_at", null)
      .select("id,title,session_number")
      .maybeSingle();
    if (error || !data) {
      return { error: dbErrorToMessage(error, "Không lưu được buổi.") };
    }
    await logAudit(supabase, {
      action: "flashcard.section.update",
      resourceType: "flashcard_section",
      resourceId: data.id,
      after: { title: data.title, session_number: data.session_number },
    });
    revalidateFlashcards();
    return { success: "Đã cập nhật buổi flashcard." };
  }

  const { data, error } = await supabase
    .from("flashcard_sections")
    .insert({
      deck_id: parsed.data.deck_id,
      session_number: parsed.data.session_number,
      title: parsed.data.title,
      created_by: actor.id,
    })
    .select("id,title,session_number")
    .single();
  if (error || !data) {
    return { error: dbErrorToMessage(error, "Không tạo được buổi.") };
  }
  await logAudit(supabase, {
    action: "flashcard.section.create",
    resourceType: "flashcard_section",
    resourceId: data.id,
    after: { title: data.title, session_number: data.session_number },
  });
  revalidateFlashcards();
  return { success: "Đã thêm buổi flashcard." };
}

const sectionIdSchema = z.object({ id: z.uuid() });

const sectionRangeSchema = z.object({
  deck_id: z.uuid("Bộ flashcard không hợp lệ."),
  from_session: z.coerce
    .number()
    .int()
    .positive("Buổi bắt đầu phải lớn hơn 0."),
  to_session: z.coerce.number().int().positive("Buổi kết thúc phải lớn hơn 0."),
});

/**
 * Tạo NHIỀU buổi trong một lượt (yêu cầu user 2026-07-24).
 *
 * Idempotency nằm ở **partial unique index của DB** + `ON CONFLICT DO NOTHING`
 * (`BUG_M09_01`), không phải ở việc app đếm trước xem buổi nào đã có — nên bấm
 * hai lần, hoặc hai admin bấm cùng lúc, đều không sinh buổi trùng.
 */
export async function createFlashcardSectionsAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = sectionRangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  if (parsed.data.to_session < parsed.data.from_session) {
    return { error: "Buổi kết thúc phải lớn hơn hoặc bằng buổi bắt đầu." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_flashcard_sections", {
    p_deck_id: parsed.data.deck_id,
    p_from: parsed.data.from_session,
    p_to: parsed.data.to_session,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không tạo được các buổi.") };
  }

  const rows = data ?? [];
  const created = rows.filter((row) => row.row_status === "created").length;
  const existing = rows.length - created;
  revalidateFlashcards();
  return {
    success:
      existing === 0
        ? `Đã tạo ${created} buổi.`
        : `Đã tạo ${created} buổi, bỏ qua ${existing} buổi đã có sẵn.`,
  };
}

/** Xoá TẤT CẢ trang trong một buổi. Xoá mềm ở DB; file media dọn khỏi bucket. */
export async function archiveFlashcardSectionPagesAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = sectionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Buổi flashcard không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "archive_flashcard_section_pages",
    { p_section_id: parsed.data.id },
  );
  if (error) {
    return { error: dbErrorToMessage(error, "Không xoá được các trang.") };
  }

  const outcome = data?.[0];
  await removeFlashcardObjects(outcome?.removed_paths ?? []);
  revalidateFlashcards();
  return {
    success: outcome?.archived_count
      ? `Đã xoá ${outcome.archived_count} trang của buổi này.`
      : "Buổi này không còn trang nào để xoá.",
  };
}

/** Xoá TẤT CẢ buổi NHÁP của một bộ thẻ. Buổi đã công bố được giữ nguyên. */
export async function archiveFlashcardDeckSectionsAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = z
    .object({ deck_id: z.uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Bộ flashcard không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "archive_flashcard_deck_sections",
    { p_deck_id: parsed.data.deck_id },
  );
  if (error) {
    return { error: dbErrorToMessage(error, "Không xoá được các buổi.") };
  }

  const outcome = data?.[0];
  await removeFlashcardObjects(outcome?.removed_paths ?? []);
  revalidateFlashcards();

  const kept = outcome?.kept_published_count ?? 0;
  return {
    success:
      kept === 0
        ? `Đã xoá ${outcome?.archived_count ?? 0} buổi.`
        : `Đã xoá ${outcome?.archived_count ?? 0} buổi nháp; giữ lại ${kept} buổi đã công bố.`,
  };
}

export type FlashcardUploadTicket = {
  slot: FlashcardMediaSlot;
  path: string;
  token: string;
  contentType: string;
};

export async function createFlashcardUploadTicketsAction(
  input: unknown,
): Promise<
  | { error: string }
  | {
      pageId: string;
      tickets: FlashcardUploadTicket[];
    }
> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardUploadRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Thông tin file tải lên không hợp lệ." };

  const slots = parsed.data.files.map((file) => file.slot);
  if (new Set(slots).size !== slots.length) {
    return { error: "Mỗi khe media của thẻ chỉ nhận một file." };
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("flashcard_sections")
    .select("id,status,deck:flashcard_decks(id)")
    .eq("id", parsed.data.sectionId)
    .is("archived_at", null)
    .maybeSingle();
  if (!section?.deck || section.status !== "draft") {
    return { error: "Chỉ tải media cho buổi flashcard đang nháp." };
  }

  const pageId = parsed.data.pageId ?? crypto.randomUUID();
  if (parsed.data.pageId) {
    const { data: page } = await supabase
      .from("flashcard_pages")
      .select("id")
      .eq("id", pageId)
      .eq("section_id", section.id)
      .is("archived_at", null)
      .maybeSingle();
    if (!page) return { error: "Trang flashcard không thuộc buổi đã chọn." };
  }

  const prepared: Array<{
    slot: FlashcardMediaSlot;
    contentType: string;
    path: string;
  }> = [];
  for (const file of parsed.data.files) {
    const format = flashcardMediaFormat(
      file.slot,
      file.fileName,
      file.mimeType,
    );
    if (!format) {
      return {
        error:
          file.slot === "audio"
            ? "Audio chỉ nhận MP3 hoặc M4A hợp lệ."
            : "Ảnh chỉ nhận JPG, PNG hoặc WEBP hợp lệ.",
      };
    }
    if (file.sizeBytes > flashcardMediaSizeLimit(file.slot)) {
      return {
        error:
          file.slot === "audio"
            ? "Audio tối đa 20 MB."
            : "Mỗi ảnh tối đa 8 MB.",
      };
    }
    prepared.push({
      slot: file.slot,
      contentType: format.mimeType,
      path: `${actor.id}/${section.deck.id}/${section.id}/${pageId}/${file.slot}-${crypto.randomUUID()}.${format.extension}`,
    });
  }

  if (!(await consumeRateLimit(supabase, "material_upload"))) {
    return { error: "Bạn đã tạo quá nhiều lượt tải file. Vui lòng thử lại." };
  }

  const tickets: FlashcardUploadTicket[] = [];
  for (const item of prepared) {
    const { data, error } = await supabase.storage
      .from(FLASHCARD_MEDIA_BUCKET)
      .createSignedUploadUrl(item.path);
    if (error || !data) {
      return { error: "Không tạo được liên kết tải media. Vui lòng thử lại." };
    }
    tickets.push({
      slot: item.slot,
      path: data.path,
      token: data.token,
      contentType: item.contentType,
    });
  }

  return { pageId, tickets };
}

export async function discardFlashcardUploadsAction(input: unknown) {
  const actor = await requireRole("super_admin");
  const parsed = z
    .object({
      deckId: z.uuid(),
      sectionId: z.uuid(),
      pageId: z.uuid(),
      paths: z.array(z.string().min(1)).max(MAX_FLASHCARD_UPLOAD_FILES),
    })
    .safeParse(input);
  if (!parsed.success) return;

  const validPaths = parsed.data.paths.filter((path) => {
    // Khe phải đọc từ TOÀN BỘ tên file. Bản trước cắt bằng `split("-", 1)` nên
    // `example-2-<uuid>.png` ra khe "example" và không khớp khe nào — file rác
    // sẽ nằm lại bucket vĩnh viễn.
    const slot = flashcardMediaSlotFromFileName(path.split("/").at(-1) ?? "");
    if (!slot) return false;
    return isOwnedFlashcardMediaPath(path, {
      actorId: actor.id,
      deckId: parsed.data.deckId,
      sectionId: parsed.data.sectionId,
      pageId: parsed.data.pageId,
      slot,
    });
  });
  await removeFlashcardObjects(validPaths);
}

async function removeFlashcardObjects(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(FLASHCARD_MEDIA_BUCKET).remove(paths);
}

// =====================================================================
// Gắn media HÀNG LOẠT cho cả buổi (`P16-T11`)
// =====================================================================

export type FlashcardBulkUploadTicket = FlashcardUploadTicket & {
  pageId: string;
};

/**
 * Xin vé tải cho **cả buổi trong MỘT lượt gọi**.
 *
 * 🔴 Một lượt gọi là ràng buộc cứng, không phải tối ưu: `consumeRateLimit` tiêu
 * một đơn vị `material_upload` mỗi lượt gọi và trần là 20 lượt/giờ. Gọi lặp cho
 * từng thẻ thì buổi ≥21 thẻ không chạy xong và admin bị khoá upload cả tiếng.
 *
 * Quy ước đường dẫn **giữ nguyên** (`actor/deck/section/page/slot-uuid.ext`) nên
 * `isOwnedFlashcardMediaPath` và policy Storage không phải sửa dòng nào.
 */
export async function createFlashcardBulkUploadTicketsAction(
  input: unknown,
): Promise<{ error: string } | { tickets: FlashcardBulkUploadTicket[] }> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardBulkUploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ." };
  }

  // Một thẻ chỉ nhận một file cho mỗi khe. Trùng ở đây nghĩa là client tính sai
  // — `matchFlashcardMediaFiles` đã loại ca đó — nên nói thẳng thay vì chọn bừa.
  const seen = new Set<string>();
  for (const item of parsed.data.items) {
    const key = `${item.pageId}:${item.slot}`;
    if (seen.has(key)) {
      return { error: "Mỗi khe media của một thẻ chỉ nhận một file." };
    }
    seen.add(key);
  }

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("flashcard_sections")
    .select("id,status,deck:flashcard_decks(id)")
    .eq("id", parsed.data.sectionId)
    .is("archived_at", null)
    .maybeSingle();
  if (!section?.deck || section.status !== "draft") {
    return { error: "Chỉ tải media cho buổi flashcard đang nháp." };
  }

  // Mọi trang phải thuộc đúng buổi này VÀ là thẻ từ vựng. Kiểm một lượt bằng
  // truy vấn tập hợp, không lặp từng trang — RPC `…077` kiểm lại lần nữa, đây
  // chỉ là chỗ trả câu tiếng Việt trước khi tốn công ký vé.
  const pageIds = [...new Set(parsed.data.items.map((item) => item.pageId))];
  const { data: pages } = await supabase
    .from("flashcard_pages")
    .select("id,kind")
    .eq("section_id", section.id)
    .is("archived_at", null)
    .in("id", pageIds);
  const usable = new Set(
    (pages ?? [])
      .filter((page) => page.kind === "vocabulary")
      .map((page) => page.id),
  );
  if (usable.size !== pageIds.length) {
    return { error: "Có thẻ không thuộc buổi đã chọn hoặc không nhận media." };
  }

  const prepared: Array<{
    pageId: string;
    slot: FlashcardMediaSlot;
    contentType: string;
    path: string;
  }> = [];
  for (const item of parsed.data.items) {
    const format = flashcardMediaFormat(
      item.slot,
      item.fileName,
      item.mimeType,
    );
    if (!format) {
      return {
        error: `File "${item.fileName}" sai định dạng — ảnh JPG/PNG/WEBP hoặc audio MP3/M4A.`,
      };
    }
    if (item.sizeBytes > flashcardMediaSizeLimit(item.slot)) {
      return {
        error:
          item.slot === "audio"
            ? `Audio "${item.fileName}" vượt 20 MB.`
            : `Ảnh "${item.fileName}" vượt 8 MB.`,
      };
    }
    prepared.push({
      pageId: item.pageId,
      slot: item.slot,
      contentType: format.mimeType,
      path: `${actor.id}/${section.deck.id}/${section.id}/${item.pageId}/${item.slot}-${crypto.randomUUID()}.${format.extension}`,
    });
  }

  if (!(await consumeRateLimit(supabase, "material_upload"))) {
    return { error: "Bạn đã tạo quá nhiều lượt tải file. Vui lòng thử lại." };
  }

  // Ký theo LÔ, không nối đuôi. Mỗi chữ ký là một round-trip độc lập, nên buổi
  // 17 thẻ trước đây phải chờ 34 round-trip xong xuôi mới tải được byte đầu
  // tiên — trên Supabase cloud (RTT ~200ms) là ngót 7 giây chết. Vẫn chặn trần
  // song song để không mở 34 kết nối một lúc.
  const signed: Array<FlashcardBulkUploadTicket | null> = [];
  for (let start = 0; start < prepared.length; start += SIGN_CONCURRENCY) {
    const batch = await Promise.all(
      prepared.slice(start, start + SIGN_CONCURRENCY).map(async (item) => {
        const { data, error } = await supabase.storage
          .from(FLASHCARD_MEDIA_BUCKET)
          .createSignedUploadUrl(item.path);
        if (error || !data) return null;
        return {
          pageId: item.pageId,
          slot: item.slot,
          path: data.path,
          token: data.token,
          contentType: item.contentType,
        };
      }),
    );
    signed.push(...batch);
  }

  if (signed.some((ticket) => ticket === null)) {
    return { error: "Không tạo được liên kết tải media. Vui lòng thử lại." };
  }

  return { tickets: signed as FlashcardBulkUploadTicket[] };
}

export type FlashcardBulkMediaOutcome = {
  attachedPageCount: number;
  attachedFrontCount: number;
  attachedAudioCount: number;
  skippedCount: number;
  /**
   * Đường dẫn bị loại vì soi ra hỏng. Trả về ĐƯỜNG DẪN chứ không phải câu chữ:
   * chỉ client mới biết đường dẫn nào ứng với tên file người soạn đã thả vào, và
   * "file nào" mới là thứ họ cần để chọn lại.
   */
  rejectedPaths: string[];
};

/**
 * Ghi đường dẫn đã tải vào từng thẻ, qua RPC `attach_flashcard_section_media`.
 *
 * ⛔ Cố ý **không** đi qua `flashcardPageSchema`: schema đó là payload CẢ TRANG,
 * dùng ở đây thì một lượt gắn audio sẽ ghi rỗng đè lên `example_sentences` /
 * `common_phrases` mà người soạn đã gõ tay — mất dữ liệu im lặng.
 *
 * `front_alt` tính ở ĐÂY bằng `flashcardAltText`, đúng một chỗ sinh alt cho cả
 * sản phẩm; RPC chỉ ghi thứ được đưa xuống và DB giữ vế cứng "có ảnh phải có alt".
 */
export async function attachFlashcardSectionMediaAction(
  input: unknown,
): Promise<
  ActionState & {
    outcome?: FlashcardBulkMediaOutcome;
    /**
     * Lỗi này KHÔNG đụng tới file đã tải lên — client phải giữ nguyên, đừng dọn.
     * Thiếu cờ này thì câu "bấm chạy lại, file vẫn còn" thành nói dối: client sẽ
     * xoá sạch ngay sau khi đọc nó.
     */
    keepUploads?: boolean;
  }
> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardMediaAssignmentSchema.safeParse(input);
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("flashcard_sections")
    .select("id,title,status,deck:flashcard_decks(id)")
    .eq("id", parsed.data.sectionId)
    .is("archived_at", null)
    .maybeSingle();
  if (!section?.deck || section.status !== "draft") {
    return { error: "Chỉ gắn media cho buổi flashcard đang nháp." };
  }

  const pageIds = parsed.data.assignments.map((item) => item.pageId);
  const { data: pages } = await supabase
    .from("flashcard_pages")
    .select("id,kind,hanzi,meaning_vi")
    .eq("section_id", section.id)
    .is("archived_at", null)
    .in("id", pageIds);
  const pageById = new Map((pages ?? []).map((page) => [page.id, page]));

  const assignments: Array<{
    page_id: string;
    front_image_path: string | null;
    front_alt: string | null;
    audio_path: string | null;
  }> = [];

  for (const item of parsed.data.assignments) {
    const page = pageById.get(item.pageId);
    if (!page || page.kind !== "vocabulary") {
      return { error: "Có thẻ không thuộc buổi đã chọn hoặc không nhận media." };
    }

    const frontPath = item.frontImagePath?.trim() || null;
    const audioPath = item.audioPath?.trim() || null;
    if (!frontPath && !audioPath) continue;

    // Thẻ từ vựng chỉ có ảnh mặt TRƯỚC; mặt sau là chữ (`…078`) nên không còn
    // vế "hai mặt phải khác file" ở đây — chỉ trang mở đầu mới có hai ảnh.
    for (const [slot, path] of [
      ["front", frontPath],
      ["audio", audioPath],
    ] as const) {
      if (!path) continue;
      if (
        !isOwnedFlashcardMediaPath(path, {
          actorId: actor.id,
          deckId: section.deck.id,
          sectionId: section.id,
          pageId: item.pageId,
          slot,
        })
      ) {
        return { error: "Đường dẫn media flashcard không hợp lệ." };
      }
    }

    assignments.push({
      page_id: item.pageId,
      front_image_path: frontPath,
      front_alt: frontPath
        ? flashcardAltText({
            kind: "vocabulary",
            face: "front",
            hanzi: page.hanzi,
            meaningVi: page.meaning_vi,
            sectionTitle: section.title,
          })
        : null,
      audio_path: audioPath,
    });
  }

  if (assignments.length === 0) {
    return { error: "Không có thẻ nào cần gắn media." };
  }

  // Đường dẫn phải trỏ tới file CÓ THẬT, đúng định dạng và trong hạn dung lượng
  // — y hệt bước kiểm của đường một thẻ. Bỏ bước này thì một yêu cầu tự chế
  // (đường dẫn đúng hình dạng nhưng chưa từng tải gì lên) sẽ ghi được vào DB, và
  // hậu quả nặng nhất không phải ảnh vỡ: `validate_flashcard_section_publish`
  // tưởng thẻ đã có audio nên cho CÔNG BỐ một buổi mà học viên bấm nghe không ra
  // tiếng.
  //
  // MỘT lượt gọi cho cả buổi (`…079`), không phải mỗi file một lượt `.info()`.
  // Buổi 17 thẻ trước đây tốn 34 round-trip nối đuôi bước tải lên vốn đã lâu, và
  // mỗi round-trip là một cơ hội hỏng riêng.
  const checks: UploadedMediaCheck[] = assignments.flatMap((item) => [
    ...(item.front_image_path
      ? [
          {
            pageId: item.page_id,
            slot: "front" as const,
            path: item.front_image_path,
          },
        ]
      : []),
    ...(item.audio_path
      ? [
          {
            pageId: item.page_id,
            slot: "audio" as const,
            path: item.audio_path,
          },
        ]
      : []),
  ]);

  const { data: infoRows, error: infoError } = await supabase.rpc(
    "flashcard_media_objects_info",
    { p_paths: checks.map((check) => check.path) },
  );

  // ⛔ Không soi được thì KHÔNG ghi gì (fail-closed) và cũng KHÔNG xoá gì. Bản
  // cũ coi mọi lỗi là "file hỏng" rồi xoá — một trục trặc đường truyền đủ để
  // thổi bay cả lượt tải mà người soạn vừa ngồi chờ xong. File vẫn nằm nguyên
  // trong bucket nên bấm chạy lại là gắn được, không phải tải lại từ đầu.
  if (infoError) {
    return {
      error:
        "Chưa kiểm tra được file vừa tải lên. Bấm chạy lại — file vẫn còn trên máy chủ, không phải chọn lại.",
      keepUploads: true,
    };
  }

  const verdict = classifyUploadedFlashcardMedia(
    checks,
    new Map(
      (infoRows ?? []).map((row) => [
        row.object_path,
        { sizeBytes: row.size_bytes, mimeType: row.mime_type },
      ]),
    ),
  );

  await removeFlashcardObjects(verdict.invalid.map((check) => check.path));

  // Bỏ RIÊNG khe hỏng, giữ nguyên phần đã soi sạch — đúng nguyên tắc "nguyên tử
  // theo TỪNG THẺ" mà bước tải lên đã theo. Bản cũ trả lỗi cho cả lượt, nên một
  // file hỏng vứt luôn 33 file lành.
  const usableByPage = new Map<string, { front?: string; audio?: string }>();
  for (const check of verdict.usable) {
    const entry = usableByPage.get(check.pageId) ?? {};
    entry[check.slot] = check.path;
    usableByPage.set(check.pageId, entry);
  }

  const keptAssignments = assignments
    .map((item) => {
      const usable = usableByPage.get(item.page_id);
      const frontPath = usable?.front ?? null;
      return {
        ...item,
        front_image_path: frontPath,
        // DB đòi "có ảnh phải có alt"; bỏ ảnh thì phải bỏ cả alt.
        front_alt: frontPath ? item.front_alt : null,
        audio_path: usable?.audio ?? null,
      };
    })
    .filter((item) => item.front_image_path || item.audio_path);

  if (keptAssignments.length === 0) {
    return {
      error: `${verdict.invalid.length} file tải lên không hợp lệ hoặc đã mất. Thử lại các thẻ đó.`,
    };
  }

  const { data, error } = await supabase.rpc(
    "attach_flashcard_section_media",
    {
      p_section_id: parsed.data.sectionId,
      p_assignments: keptAssignments,
      p_allow_overwrite: parsed.data.allowOverwrite,
    },
  );
  if (error) {
    return { error: dbErrorToMessage(error, "Không gắn được media cho buổi.") };
  }

  const results = data ?? [];
  const outcome: FlashcardBulkMediaOutcome = {
    attachedPageCount: results.filter(
      (row) => row.attached_front || row.attached_audio,
    ).length,
    attachedFrontCount: results.filter((row) => row.attached_front).length,
    attachedAudioCount: results.filter((row) => row.attached_audio).length,
    skippedCount: results.filter(
      (row) => row.skipped_front || row.skipped_audio,
    ).length,
    rejectedPaths: verdict.invalid.map((check) => check.path),
  };

  // File cũ vừa bị thay: dọn khỏi bucket private. RPC trả danh sách vì chỉ nó
  // biết chắc đường dẫn nào thật sự bị bỏ ra sau khi đã áp luật ghi đè.
  await removeFlashcardObjects([
    ...new Set(results.flatMap((row) => row.removed_paths ?? [])),
  ]);

  await logAudit(supabase, {
    action: "flashcard.page.media.bulk_attach",
    resourceType: "flashcard_section",
    resourceId: parsed.data.sectionId,
    after: outcome,
  });
  revalidateFlashcards();

  const notes = [
    outcome.skippedCount > 0
      ? `bỏ qua ${outcome.skippedCount} thẻ đã có sẵn`
      : null,
    outcome.rejectedPaths.length > 0
      ? `loại ${outcome.rejectedPaths.length} file hỏng`
      : null,
  ].filter((note): note is string => note !== null);

  return {
    success:
      notes.length === 0
        ? `Đã gắn media cho ${outcome.attachedPageCount} thẻ.`
        : `Đã gắn media cho ${outcome.attachedPageCount} thẻ, ${notes.join(", ")}.`,
    outcome,
  };
}

// =====================================================================
// Gắn ảnh TRANG MỞ ĐẦU hàng loạt cho cả BỘ THẺ (`COVER-1`)
// =====================================================================

export type FlashcardCoverTicket = {
  sectionId: string;
  pageId: string;
  path: string;
  token: string;
  contentType: string;
};

/**
 * Xin vé tải ảnh mở đầu cho **cả bộ trong MỘT lượt gọi**.
 *
 * 🔴 Một lượt gọi là ràng buộc cứng, không phải tối ưu — cùng lý do đã ghi ở
 * `createFlashcardBulkUploadTicketsAction`: `consumeRateLimit` tiêu một đơn vị
 * `material_upload` mỗi lượt gọi, trần 20 lượt/giờ, mà một bộ có tới 35 buổi.
 *
 * 🔴 `pageId` phải chốt Ở ĐÂY chứ không phải lúc ghi: đường dẫn object mang
 * `pageId` (`actor/deck/section/page/front-<uuid>.<ext>`) và
 * `isOwnedFlashcardMediaPath` soi lại đúng năm đoạn đó. Buổi đã có trang mở đầu
 * thì dùng LẠI mã trang cũ — sinh mã mới sẽ làm ảnh vừa tải thành file mà chính
 * trang ấy không sở hữu, và lượt sửa trang tiếp theo sẽ từ chối nó.
 *
 * Quy ước đường dẫn giữ nguyên nên policy Storage không phải sửa dòng nào.
 */
export async function createFlashcardDeckCoverTicketsAction(
  input: unknown,
): Promise<{ error: string } | { tickets: FlashcardCoverTicket[] }> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardDeckCoverUploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Yêu cầu không hợp lệ." };
  }

  // Một buổi chỉ nhận một ảnh mở đầu. Trùng ở đây nghĩa là client tính sai —
  // `matchFlashcardCoverFiles` đã loại ca đó — nên nói thẳng thay vì chọn bừa.
  const seen = new Set<string>();
  for (const item of parsed.data.items) {
    if (seen.has(item.sectionId)) {
      return { error: "Mỗi buổi chỉ nhận một ảnh mở đầu trong một lượt." };
    }
    seen.add(item.sectionId);
  }

  const supabase = await createClient();
  const { data: deck } = await supabase
    .from("flashcard_decks")
    .select("id")
    .eq("id", parsed.data.deckId)
    .maybeSingle();
  if (!deck) return { error: "Không tìm thấy bộ flashcard." };

  const sectionIds = [...seen];
  const { data: sections } = await supabase
    .from("flashcard_sections")
    .select("id,status")
    .eq("deck_id", deck.id)
    .is("archived_at", null)
    .in("id", sectionIds);
  const draftSections = new Set(
    (sections ?? [])
      .filter((section) => section.status === "draft")
      .map((section) => section.id),
  );
  if (draftSections.size !== sectionIds.length) {
    return {
      error: "Có buổi không thuộc bộ đã chọn hoặc không còn ở bản nháp.",
    };
  }

  // Trang mở đầu ĐANG CÓ của từng buổi — nguồn của `pageId` dùng lại.
  const { data: covers } = await supabase
    .from("flashcard_pages")
    .select("id,section_id")
    .in("section_id", sectionIds)
    .eq("kind", "session_cover")
    .is("archived_at", null);
  const pageIdBySection = new Map(
    (covers ?? []).map((page) => [page.section_id, page.id]),
  );

  const prepared: Array<{
    sectionId: string;
    pageId: string;
    contentType: string;
    path: string;
  }> = [];
  for (const item of parsed.data.items) {
    const format = flashcardMediaFormat("front", item.fileName, item.mimeType);
    if (!format) {
      return {
        error: `Ảnh "${item.fileName}" sai định dạng — chỉ nhận JPG, PNG hoặc WEBP.`,
      };
    }
    if (item.sizeBytes > flashcardMediaSizeLimit("front")) {
      return { error: `Ảnh "${item.fileName}" vượt 8 MB.` };
    }
    const pageId = pageIdBySection.get(item.sectionId) ?? crypto.randomUUID();
    prepared.push({
      sectionId: item.sectionId,
      pageId,
      contentType: format.mimeType,
      path: `${actor.id}/${deck.id}/${item.sectionId}/${pageId}/front-${crypto.randomUUID()}.${format.extension}`,
    });
  }

  if (!(await consumeRateLimit(supabase, "material_upload"))) {
    return { error: "Bạn đã tạo quá nhiều lượt tải file. Vui lòng thử lại." };
  }

  // Ký theo LÔ, không nối đuôi — cùng lý do đã đo ở `…077`: 35 round-trip nối
  // đuôi trên Supabase cloud (RTT ~200ms) là ngót 7 giây chết trước khi tải được
  // byte đầu tiên.
  const signed: Array<FlashcardCoverTicket | null> = [];
  for (let start = 0; start < prepared.length; start += SIGN_CONCURRENCY) {
    const batch = await Promise.all(
      prepared.slice(start, start + SIGN_CONCURRENCY).map(async (item) => {
        const { data, error } = await supabase.storage
          .from(FLASHCARD_MEDIA_BUCKET)
          .createSignedUploadUrl(item.path);
        if (error || !data) return null;
        return {
          sectionId: item.sectionId,
          pageId: item.pageId,
          path: data.path,
          token: data.token,
          contentType: item.contentType,
        };
      }),
    );
    signed.push(...batch);
  }

  if (signed.some((ticket) => ticket === null)) {
    return { error: "Không tạo được liên kết tải ảnh. Vui lòng thử lại." };
  }

  return { tickets: signed as FlashcardCoverTicket[] };
}

export type FlashcardCoverOutcome = {
  createdCount: number;
  replacedCount: number;
  skippedExistingCount: number;
  skippedPublishedCount: number;
  /** Đường dẫn bị loại vì soi ra hỏng — client đổi ngược về tên file. */
  rejectedPaths: string[];
};

/**
 * Ghi ảnh mở đầu đã tải vào từng buổi, qua RPC `attach_flashcard_deck_covers`.
 *
 * `front_alt` tính ở ĐÂY bằng `flashcardAltText` — đúng một chỗ sinh alt cho cả
 * sản phẩm (xem `…077`); RPC chỉ ghi thứ được đưa xuống và DB giữ vế cứng "có
 * ảnh phải có alt".
 */
export async function attachFlashcardDeckCoversAction(
  input: unknown,
): Promise<
  ActionState & {
    outcome?: FlashcardCoverOutcome;
    /** Xem `attachFlashcardSectionMediaAction`: lỗi này KHÔNG đụng file đã tải. */
    keepUploads?: boolean;
  }
> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardDeckCoverAssignmentSchema.safeParse(input);
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: deck } = await supabase
    .from("flashcard_decks")
    .select("id")
    .eq("id", parsed.data.deckId)
    .maybeSingle();
  if (!deck) return { error: "Không tìm thấy bộ flashcard." };

  const sectionIds = parsed.data.assignments.map((item) => item.sectionId);
  const { data: sections } = await supabase
    .from("flashcard_sections")
    .select("id,title,status")
    .eq("deck_id", deck.id)
    .is("archived_at", null)
    .in("id", sectionIds);
  const sectionById = new Map(
    (sections ?? []).map((section) => [section.id, section]),
  );

  const covers: Array<{
    section_id: string;
    page_id: string;
    front_image_path: string;
    front_alt: string;
  }> = [];

  for (const item of parsed.data.assignments) {
    const section = sectionById.get(item.sectionId);
    if (!section) return { error: "Có buổi không thuộc bộ đã chọn." };

    if (
      !isOwnedFlashcardMediaPath(item.frontImagePath, {
        actorId: actor.id,
        deckId: deck.id,
        sectionId: item.sectionId,
        pageId: item.pageId,
        slot: "front",
      })
    ) {
      return { error: "Đường dẫn ảnh mở đầu không hợp lệ." };
    }

    covers.push({
      section_id: item.sectionId,
      page_id: item.pageId,
      front_image_path: item.frontImagePath,
      front_alt: flashcardAltText({
        kind: "session_cover",
        face: "front",
        hanzi: null,
        meaningVi: null,
        sectionTitle: section.title,
      }),
    });
  }

  // Đường dẫn phải trỏ tới file CÓ THẬT, đúng định dạng và trong hạn dung lượng
  // — y hệt hai đường gắn media đã có. Bỏ bước này thì một yêu cầu tự chế (đường
  // dẫn đúng hình dạng nhưng chưa từng tải gì lên) sẽ ghi được vào DB, và buổi
  // đó công bố ra một trang mở đầu ảnh vỡ trên chính mã QR in trong sách.
  const checks: UploadedMediaCheck[] = covers.map((item) => ({
    pageId: item.page_id,
    slot: "front" as const,
    path: item.front_image_path,
  }));

  const { data: infoRows, error: infoError } = await supabase.rpc(
    "flashcard_media_objects_info",
    { p_paths: checks.map((check) => check.path) },
  );

  // ⛔ Không soi được thì KHÔNG ghi gì (fail-closed) và cũng KHÔNG xoá gì.
  if (infoError) {
    return {
      error:
        "Chưa kiểm tra được ảnh vừa tải lên. Bấm chạy lại — ảnh vẫn còn trên máy chủ, không phải chọn lại.",
      keepUploads: true,
    };
  }

  const verdict = classifyUploadedFlashcardMedia(
    checks,
    new Map(
      (infoRows ?? []).map((row) => [
        row.object_path,
        { sizeBytes: row.size_bytes, mimeType: row.mime_type },
      ]),
    ),
  );

  await removeFlashcardObjects(verdict.invalid.map((check) => check.path));

  // Bỏ RIÊNG buổi có ảnh hỏng, giữ nguyên phần đã soi sạch — nguyên tử theo
  // TỪNG BUỔI. Trả lỗi cho cả lượt thì một ảnh hỏng vứt luôn 34 ảnh lành.
  const usablePaths = new Set(verdict.usable.map((check) => check.path));
  const keptCovers = covers.filter((item) =>
    usablePaths.has(item.front_image_path),
  );

  if (keptCovers.length === 0) {
    return {
      error: `${verdict.invalid.length} ảnh tải lên không hợp lệ hoặc đã mất. Thử lại các buổi đó.`,
    };
  }

  const { data, error } = await supabase.rpc("attach_flashcard_deck_covers", {
    p_deck_id: parsed.data.deckId,
    p_covers: keptCovers,
    p_allow_overwrite: parsed.data.allowOverwrite,
  });
  if (error) {
    return {
      error: dbErrorToMessage(error, "Không gắn được ảnh mở đầu cho bộ thẻ."),
    };
  }

  const results = data ?? [];
  const countOf = (status: string) =>
    results.filter((row) => row.row_status === status).length;
  const outcome: FlashcardCoverOutcome = {
    createdCount: countOf("created"),
    replacedCount: countOf("replaced"),
    skippedExistingCount: countOf("skipped_existing"),
    skippedPublishedCount: countOf("skipped_published"),
    rejectedPaths: verdict.invalid.map((check) => check.path),
  };

  // Ảnh của buổi bị RPC bỏ qua vẫn nằm trong bucket mà không trang nào trỏ tới —
  // dọn luôn, cùng lượt với file cũ vừa bị thay. Không dọn thì mỗi lần bấm nhầm
  // với ô Ghi đè đang TẮT lại để lại một nắm ảnh mồ côi.
  const attachedSectionIds = new Set(
    results
      .filter(
        (row) => row.row_status === "created" || row.row_status === "replaced",
      )
      .map((row) => row.section_id),
  );
  const orphanPaths = keptCovers
    .filter((item) => !attachedSectionIds.has(item.section_id))
    .map((item) => item.front_image_path);

  await removeFlashcardObjects([
    ...new Set([
      ...results.flatMap((row) => row.removed_paths ?? []),
      ...orphanPaths,
    ]),
  ]);

  await logAudit(supabase, {
    action: "flashcard.deck.covers.bulk_attach",
    resourceType: "flashcard_deck",
    resourceId: parsed.data.deckId,
    after: outcome,
  });
  revalidateFlashcards();

  const notes = [
    outcome.skippedExistingCount > 0
      ? `bỏ qua ${outcome.skippedExistingCount} buổi đã có ảnh`
      : null,
    outcome.skippedPublishedCount > 0
      ? `bỏ qua ${outcome.skippedPublishedCount} buổi đã công bố`
      : null,
    outcome.rejectedPaths.length > 0
      ? `loại ${outcome.rejectedPaths.length} ảnh hỏng`
      : null,
  ].filter((note): note is string => note !== null);

  const touched = outcome.createdCount + outcome.replacedCount;
  return {
    success:
      notes.length === 0
        ? `Đã gắn ảnh mở đầu cho ${touched} buổi.`
        : `Đã gắn ảnh mở đầu cho ${touched} buổi, ${notes.join(", ")}.`,
    outcome,
  };
}

/**
 * Mọi media của trang, kèm KHE mà nó được khai báo.
 *
 * Khe phải đi cùng đường dẫn chứ không suy ngược từ tên file: có vậy mới chặn
 * được trò khai một file `front-….png` vào ô audio — `isOwnedFlashcardMediaPath`
 * so khe khai báo với khe trong tên file và với đuôi file.
 */
function declaredMedia(
  input: FlashcardPageInput,
): Array<{ slot: FlashcardMediaSlot; path: string }> {
  // Trang mở đầu chỉ còn MỘT khe ảnh (`…084`): một file vẽ cho cả hai mặt.
  if (input.kind === "session_cover") {
    return [{ slot: "front", path: input.front_image_path }];
  }

  const media: Array<{ slot: FlashcardMediaSlot; path: string }> = [];
  if (input.audio_path) {
    media.push({ slot: "audio", path: input.audio_path });
  }
  if (input.front_image_path) {
    media.push({ slot: "front", path: input.front_image_path });
  }
  // Thẻ từ vựng không còn ảnh mặt sau (`…078`): mặt sau là chữ.
  input.example_sentences.forEach((example, index) => {
    if (example.image_path) {
      media.push({ slot: exampleMediaSlot(index), path: example.image_path });
    }
  });
  return media;
}

function pageValues(input: FlashcardPageInput, sectionTitle: string) {
  const hanzi = input.kind === "vocabulary" ? input.hanzi : null;
  const meaningVi = input.kind === "vocabulary" ? input.meaning_vi : null;
  const frontPath = input.front_image_path ?? null;

  const altFor = (face: "front" | "back") =>
    flashcardAltText({ kind: input.kind, face, hanzi, meaningVi, sectionTitle });

  return {
    kind: input.kind,
    hanzi,
    pinyin_syllables:
      input.kind === "vocabulary" ? input.pinyin_syllables : null,
    meaning_vi: meaningVi,
    audio_path: input.kind === "vocabulary" ? (input.audio_path ?? null) : null,
    front_image_path: frontPath,
    // Ảnh mặt sau đã nghỉ hưu với MỌI `kind` (`…084`): thẻ từ vựng có mặt sau
    // bằng chữ (`…078`), trang mở đầu vẽ lại chính ảnh mặt trước. Ghi thẳng
    // `null` chứ không bỏ cột ra khỏi payload: trang mở đầu CŨ đang mang đường
    // dẫn mặt sau, và chỉ có phép gán tường minh mới dọn được nó khi admin lưu
    // lại trang — bỏ cột ra thì `update` giữ nguyên giá trị cũ và constraint nổ.
    back_image_path: null,
    // `flashcard_pages_alt_pairing_check`: có ảnh thì phải có alt, không ảnh thì
    // alt phải rỗng. Sinh alt cho ảnh không tồn tại là tự tạo dữ liệu ma.
    front_alt: frontPath ? altFor("front") : null,
    back_alt: null,
    // Khối "Tách nghĩa" (`sense_breakdown`) đã xoá khỏi cả code lẫn DB
    // (migration `…074`, sau khi user đếm cloud ra 0 hàng mang dữ liệu).
    example_sentences:
      input.kind === "vocabulary" ? input.example_sentences : [],
    common_phrases: input.kind === "vocabulary" ? input.common_phrases : [],
  };
}

export async function saveFlashcardPageAction(
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardPageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);
  const input = parsed.data;

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("flashcard_sections")
    .select("id,status,title,deck:flashcard_decks(id)")
    .eq("id", input.section_id)
    .is("archived_at", null)
    .maybeSingle();
  if (!section?.deck || section.status !== "draft") {
    return { error: "Chỉ sửa trang trong buổi flashcard đang nháp." };
  }

  const { data: existing } = await supabase
    .from("flashcard_pages")
    .select("*")
    .eq("id", input.id)
    .eq("section_id", input.section_id)
    .is("archived_at", null)
    .maybeSingle();

  // Bản cũ lặng lẽ lấy `existing.kind` và bỏ qua `kind` được gửi lên. Im lặng
  // như vậy che mất một yêu cầu sai; nói thẳng ra thì người gọi sửa được.
  if (existing && existing.kind !== input.kind) {
    return {
      error: "Không đổi được loại trang sau khi đã tạo. Hãy lưu trữ rồi tạo lại.",
    };
  }

  const media = declaredMedia(input);
  // `media_paths` là bản kê media mà DB đang giữ cho trang này, nên so sánh với
  // nó là cách duy nhất biết chắc file nào vừa thêm và file nào vừa bị bỏ ra.
  const previousPaths = new Set(existing?.media_paths ?? []);
  const nextPaths = new Set(media.map((item) => item.path));
  const addedPaths = [...nextPaths].filter((path) => !previousPaths.has(path));

  const failWithCleanup = async (error: string): Promise<ActionState> => {
    await removeFlashcardObjects(addedPaths);
    return { error };
  };

  for (const { slot, path } of media) {
    if (previousPaths.has(path)) continue;

    if (
      !isOwnedFlashcardMediaPath(path, {
        actorId: actor.id,
        deckId: section.deck.id,
        sectionId: section.id,
        pageId: input.id,
        slot,
      })
    ) {
      return failWithCleanup("Đường dẫn media flashcard không hợp lệ.");
    }

    const { data: info, error: infoError } = await supabase.storage
      .from(FLASHCARD_MEDIA_BUCKET)
      .info(path);
    const format = flashcardMediaFormat(slot, path, info?.contentType);
    if (
      infoError ||
      !info ||
      !format ||
      typeof info.size !== "number" ||
      info.size <= 0 ||
      info.size > flashcardMediaSizeLimit(slot)
    ) {
      return failWithCleanup(
        `File ở khe ${slot} không tồn tại hoặc sai định dạng/kích thước.`,
      );
    }
  }

  let orderIndex = existing?.order_index;
  if (orderIndex === undefined) {
    const { data: activePages } = await supabase
      .from("flashcard_pages")
      .select("kind,order_index")
      .eq("section_id", section.id)
      .is("archived_at", null)
      .order("order_index");
    if (input.kind === "session_cover") {
      if (activePages?.some((page) => page.kind === "session_cover")) {
        return failWithCleanup("Buổi này đã có trang mở đầu.");
      }
      orderIndex = 0;
    } else {
      orderIndex = Math.max(1, (activePages?.at(-1)?.order_index ?? 0) + 1);
    }
  }

  const values = pageValues(input, section.title);
  const result = existing
    ? await supabase
        .from("flashcard_pages")
        .update(values)
        .eq("id", existing.id)
        .select("id,kind,hanzi")
        .single()
    : await supabase
        .from("flashcard_pages")
        .insert({
          id: input.id,
          section_id: input.section_id,
          order_index: orderIndex,
          created_by: actor.id,
          ...values,
        })
        .select("id,kind,hanzi")
        .single();

  if (result.error || !result.data) {
    return failWithCleanup(
      dbErrorToMessage(result.error, "Không lưu được trang flashcard."),
    );
  }

  // File cũ không còn được trang tham chiếu nữa thì dọn khỏi bucket private.
  const droppedPaths = [...previousPaths].filter(
    (path) => !nextPaths.has(path),
  );
  await removeFlashcardObjects(droppedPaths);

  await logAudit(supabase, {
    action: existing ? "flashcard.page.update" : "flashcard.page.create",
    resourceType: "flashcard_page",
    resourceId: result.data.id,
    before: existing
      ? {
          kind: existing.kind,
          hanzi: existing.hanzi,
          section_id: existing.section_id,
        }
      : undefined,
    after: {
      kind: result.data.kind,
      hanzi: result.data.hanzi,
      section_id: input.section_id,
    },
  });
  revalidateFlashcards();
  return {
    success: existing
      ? "Đã cập nhật trang flashcard."
      : "Đã thêm trang flashcard.",
  };
}

export type FlashcardImportOutcome = {
  createdCount: number;
  duplicateCount: number;
};

/**
 * Nhập hàng loạt thẻ từ vựng (`P16-T4`).
 *
 * Zod kiểm **từng dòng** ở đây (`DS-050`: Zod là chỗ cưỡng chế duy nhất), rồi
 * RPC lo chèn. Idempotency nằm ở **unique index của DB** + `ON CONFLICT DO
 * NOTHING`, không phải ở vòng lặp này (`BUG_M09_01`) — nên dù request có được
 * gửi lại hai lần thì cũng không sinh thẻ trùng.
 */
export async function importFlashcardVocabularyAction(
  input: unknown,
): Promise<ActionState & { outcome?: FlashcardImportOutcome }> {
  await requireRole("super_admin");
  const parsed = z
    .object({
      sectionId: z.uuid(),
      rows: z
        .array(flashcardImportRowSchema)
        .min(1, "Chưa có dòng nào hợp lệ để nhập.")
        .max(
          MAX_FLASHCARD_IMPORT_ROWS,
          `Mỗi lượt nhập tối đa ${MAX_FLASHCARD_IMPORT_ROWS} dòng.`,
        ),
    })
    .safeParse(input);
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_flashcard_vocabulary", {
    p_section_id: parsed.data.sectionId,
    p_rows: parsed.data.rows,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không nhập được danh sách thẻ.") };
  }

  const results = data ?? [];
  const createdCount = results.filter(
    (item) => item.row_status === "created",
  ).length;
  const duplicateCount = results.filter(
    (item) => item.row_status === "duplicate",
  ).length;

  await logAudit(supabase, {
    action: "flashcard.page.import",
    resourceType: "flashcard_section",
    resourceId: parsed.data.sectionId,
    after: { created: createdCount, duplicate: duplicateCount },
  });
  revalidateFlashcards();

  return {
    success:
      duplicateCount === 0
        ? `Đã tạo ${createdCount} thẻ.`
        : `Đã tạo ${createdCount} thẻ, bỏ qua ${duplicateCount} thẻ đã có sẵn.`,
    outcome: { createdCount, duplicateCount },
  };
}

/**
 * ★ thẻ khó — nhận trạng thái MONG MUỐN, không phải "đảo trạng thái".
 *
 * RPC `set_flashcard_star` là đường ghi duy nhất; idempotency nằm ở khoá chính
 * ghép của bảng (`BUG_M09_01`), nên bấm lặp không tạo hàng thừa dù app có gửi
 * lại request hay không.
 */
export async function setFlashcardStarAction(
  input: unknown,
): Promise<ActionState> {
  await requireRole("student");
  const parsed = z
    .object({ pageId: z.uuid(), starred: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { error: "Yêu cầu đánh dấu không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_flashcard_star", {
    p_page_id: parsed.data.pageId,
    p_starred: parsed.data.starred,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không lưu được đánh dấu.") };
  }

  revalidatePath("/student/review");
  return {
    success: parsed.data.starred
      ? "Đã đánh dấu thẻ khó."
      : "Đã bỏ đánh dấu thẻ khó.",
  };
}

export async function publishFlashcardSectionAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = sectionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Buổi flashcard không hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_flashcard_section", {
    p_section_id: parsed.data.id,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không công bố được buổi.") };
  }
  revalidateFlashcards();
  return { success: "Đã công bố buổi flashcard." };
}

export async function unpublishFlashcardSectionAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = sectionIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Buổi flashcard không hợp lệ." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("flashcard_sections")
    .update({ status: "draft", published_at: null })
    .eq("id", parsed.data.id)
    .is("archived_at", null);
  if (error) {
    return { error: dbErrorToMessage(error, "Không đưa buổi về nháp.") };
  }
  await logAudit(supabase, {
    action: "flashcard.section.unpublish",
    resourceType: "flashcard_section",
    resourceId: parsed.data.id,
  });
  revalidateFlashcards();
  return { success: "Đã đưa buổi flashcard về nháp để chỉnh sửa." };
}

const pageMutationSchema = z.object({
  id: z.uuid(),
  direction: z.enum(["up", "down"]).optional(),
});

export async function moveFlashcardPageAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = pageMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.direction) {
    return { error: "Yêu cầu sắp xếp không hợp lệ." };
  }
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("flashcard_pages")
    .select("id,section_id,kind")
    .eq("id", parsed.data.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!page || page.kind === "session_cover") {
    return { error: "Không thể di chuyển trang mở đầu." };
  }
  const { data: pages } = await supabase
    .from("flashcard_pages")
    .select("id,kind")
    .eq("section_id", page.section_id)
    .is("archived_at", null)
    .order("order_index");
  const ids = pages?.map((item) => item.id) ?? [];
  // Còn trang mở đầu thì nó khóa vị trí 0; đã lưu trữ thì từ vựng được đứng đầu.
  const minIndex = pages?.some((item) => item.kind === "session_cover") ? 1 : 0;
  const index = ids.indexOf(page.id);
  const target = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index < minIndex || target < minIndex || target >= ids.length) {
    return { success: "Trang đã ở vị trí ngoài cùng." };
  }
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  const { error } = await supabase.rpc("reorder_flashcard_pages", {
    p_section_id: page.section_id,
    p_page_ids: ids,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không sắp xếp được trang.") };
  }
  revalidateFlashcards();
  return { success: "Đã đổi thứ tự trang." };
}

export async function archiveFlashcardPageAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = pageMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Trang flashcard không hợp lệ." };
  const supabase = await createClient();
  // `media_paths` gom đủ cả ảnh của câu ví dụ; liệt kê ba cột như bản cũ sẽ để
  // ảnh câu ví dụ nằm lại bucket sau khi trang đã bị lưu trữ.
  const { data: page } = await supabase
    .from("flashcard_pages")
    .select("media_paths")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { error } = await supabase.rpc("archive_flashcard_page", {
    p_page_id: parsed.data.id,
  });
  if (error) {
    return { error: dbErrorToMessage(error, "Không lưu trữ được trang.") };
  }
  if (page) await removeFlashcardObjects(page.media_paths);
  revalidateFlashcards();
  return { success: "Đã lưu trữ trang flashcard." };
}
