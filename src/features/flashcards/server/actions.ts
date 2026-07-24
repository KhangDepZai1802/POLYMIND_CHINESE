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
  flashcardDeckSchema,
  flashcardImportRowSchema,
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

function revalidateFlashcards() {
  revalidatePath(FLASHCARD_PATH);
  revalidatePath("/student/review");
}

export async function saveFlashcardDeckAction(
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardDeckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flashcard_decks")
    .insert({
      course_id: parsed.data.course_id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      created_by: actor.id,
    })
    .select("id,title,course_id")
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
    after: { title: data.title, course_id: data.course_id },
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
  if (input.kind === "session_cover") {
    return [
      { slot: "front", path: input.front_image_path },
      { slot: "back", path: input.back_image_path },
    ];
  }

  const media: Array<{ slot: FlashcardMediaSlot; path: string }> = [];
  if (input.audio_path) {
    media.push({ slot: "audio", path: input.audio_path });
  }
  if (input.front_image_path) {
    media.push({ slot: "front", path: input.front_image_path });
  }
  if (input.back_image_path) {
    media.push({ slot: "back", path: input.back_image_path });
  }
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
  const backPath = input.back_image_path ?? null;

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
    back_image_path: backPath,
    // `flashcard_pages_alt_pairing_check`: có ảnh thì phải có alt, không ảnh thì
    // alt phải rỗng. Sinh alt cho ảnh không tồn tại là tự tạo dữ liệu ma.
    front_alt: frontPath ? altFor("front") : null,
    back_alt: backPath ? altFor("back") : null,
    sense_breakdown:
      input.kind === "vocabulary" ? input.sense_breakdown : [],
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

const sectionIdSchema = z.object({ id: z.uuid() });

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
    .eq("id", parsed.data.id);
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
