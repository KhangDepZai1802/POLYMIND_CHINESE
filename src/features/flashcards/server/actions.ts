"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  FLASHCARD_MEDIA_BUCKET,
  flashcardAltText,
  flashcardMediaFormat,
  flashcardMediaSizeLimit,
  isOwnedFlashcardMediaPath,
  type FlashcardMediaSlot,
} from "@/features/flashcards/domain/media";
import {
  flashcardDeckSchema,
  flashcardPageSchema,
  flashcardSectionSchema,
  flashcardUploadRequestSchema,
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
    return { error: "Mỗi mặt flashcard chỉ nhận một file." };
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
      paths: z.array(z.string().min(1)).max(3),
    })
    .safeParse(input);
  if (!parsed.success) return;

  const validPaths = parsed.data.paths.filter((path) => {
    const slot = path.split("/").at(-1)?.split("-", 1)[0];
    if (slot !== "front" && slot !== "back" && slot !== "audio") return false;
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

export async function saveFlashcardPageAction(
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("super_admin");
  const parsed = flashcardPageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: section } = await supabase
    .from("flashcard_sections")
    .select("id,status,title,deck:flashcard_decks(id)")
    .eq("id", parsed.data.section_id)
    .maybeSingle();
  if (!section?.deck || section.status !== "draft") {
    return { error: "Chỉ sửa trang trong buổi flashcard đang nháp." };
  }

  const { data: existing } = await supabase
    .from("flashcard_pages")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("section_id", parsed.data.section_id)
    .is("archived_at", null)
    .maybeSingle();

  const kind = existing?.kind ?? parsed.data.kind;
  // Trang mở đầu chỉ gồm hai ảnh; audio là ràng buộc riêng của trang từ vựng.
  const audioPath = kind === "vocabulary" ? parsed.data.audio_path : null;
  if (kind === "vocabulary" && !audioPath) {
    return { error: "Trang từ vựng cần audio phát âm." };
  }

  const media: Array<[FlashcardMediaSlot, string, string | null]> = [
    ["front", parsed.data.front_image_path, existing?.front_image_path ?? null],
    ["back", parsed.data.back_image_path, existing?.back_image_path ?? null],
  ];
  if (audioPath) {
    media.push(["audio", audioPath, existing?.audio_path ?? null]);
  }
  const newPaths = media
    .filter(([, path, oldPath]) => path !== oldPath)
    .map(([, path]) => path);

  for (const [slot, path, oldPath] of media) {
    if (
      path !== oldPath &&
      !isOwnedFlashcardMediaPath(path, {
        actorId: actor.id,
        deckId: section.deck.id,
        sectionId: section.id,
        pageId: parsed.data.id,
        slot,
      })
    ) {
      await removeFlashcardObjects(newPaths);
      return { error: "Đường dẫn media flashcard không hợp lệ." };
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
      await removeFlashcardObjects(newPaths);
      return {
        error: `File ${slot} không tồn tại hoặc sai định dạng/kích thước.`,
      };
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
    if (kind === "session_cover") {
      if (activePages?.some((page) => page.kind === "session_cover")) {
        await removeFlashcardObjects(newPaths);
        return { error: "Buổi này đã có trang mở đầu." };
      }
      orderIndex = 0;
    } else {
      orderIndex = Math.max(1, (activePages?.at(-1)?.order_index ?? 0) + 1);
    }
  }

  const term = kind === "vocabulary" ? parsed.data.term : null;
  const values = {
    kind,
    term,
    front_alt: flashcardAltText({
      kind,
      face: "front",
      term,
      sectionTitle: section.title,
    }),
    back_alt: flashcardAltText({
      kind,
      face: "back",
      term,
      sectionTitle: section.title,
    }),
    front_image_path: parsed.data.front_image_path,
    back_image_path: parsed.data.back_image_path,
    audio_path: audioPath,
  };

  const result = existing
    ? await supabase
        .from("flashcard_pages")
        .update(values)
        .eq("id", existing.id)
        .select("id,kind,term")
        .single()
    : await supabase
        .from("flashcard_pages")
        .insert({
          id: parsed.data.id,
          section_id: parsed.data.section_id,
          order_index: orderIndex,
          created_by: actor.id,
          ...values,
        })
        .select("id,kind,term")
        .single();

  if (result.error || !result.data) {
    await removeFlashcardObjects(newPaths);
    return {
      error: dbErrorToMessage(result.error, "Không lưu được trang flashcard."),
    };
  }

  const replacedPaths = existing
    ? [
        ...media
          .filter(([, path, oldPath]) => Boolean(oldPath) && path !== oldPath)
          .map(([, , oldPath]) => oldPath!),
        // Trang mở đầu không còn dùng audio: dọn file cũ để không mồ côi trong bucket.
        ...(kind === "session_cover" && existing.audio_path
          ? [existing.audio_path]
          : []),
      ]
    : [];
  await removeFlashcardObjects(replacedPaths);
  await logAudit(supabase, {
    action: existing ? "flashcard.page.update" : "flashcard.page.create",
    resourceType: "flashcard_page",
    resourceId: result.data.id,
    before: existing
      ? {
          kind: existing.kind,
          term: existing.term,
          section_id: existing.section_id,
        }
      : undefined,
    after: {
      kind: result.data.kind,
      term: result.data.term,
      section_id: parsed.data.section_id,
    },
  });
  revalidateFlashcards();
  return {
    success: existing
      ? "Đã cập nhật trang flashcard."
      : "Đã thêm trang flashcard.",
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
  if (error)
    return { error: dbErrorToMessage(error, "Không công bố được buổi.") };
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
  if (error)
    return { error: dbErrorToMessage(error, "Không đưa buổi về nháp.") };
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
    .select("id")
    .eq("section_id", page.section_id)
    .is("archived_at", null)
    .order("order_index");
  const ids = pages?.map((item) => item.id) ?? [];
  const index = ids.indexOf(page.id);
  const target = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (index <= 0 || target <= 0 || target >= ids.length) {
    return { success: "Trang đã ở vị trí ngoài cùng." };
  }
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  const { error } = await supabase.rpc("reorder_flashcard_pages", {
    p_section_id: page.section_id,
    p_page_ids: ids,
  });
  if (error)
    return { error: dbErrorToMessage(error, "Không sắp xếp được trang.") };
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
  const { data: page } = await supabase
    .from("flashcard_pages")
    .select("front_image_path,back_image_path,audio_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  const { error } = await supabase.rpc("archive_flashcard_page", {
    p_page_id: parsed.data.id,
  });
  if (error)
    return { error: dbErrorToMessage(error, "Không lưu trữ được trang.") };
  if (page) {
    await removeFlashcardObjects(
      [page.front_image_path, page.back_image_path, page.audio_path].filter(
        (path): path is string => Boolean(path),
      ),
    );
  }
  revalidateFlashcards();
  return { success: "Đã lưu trữ trang flashcard." };
}
