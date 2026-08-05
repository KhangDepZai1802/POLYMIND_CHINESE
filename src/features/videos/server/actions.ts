"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fetchYoutubeTitles } from "@/features/videos/server/youtube-oembed";
import { MAX_VIDEO_IMPORT_ROWS } from "@/features/videos/domain/youtube-url";
import { dbErrorToMessage, type ActionState } from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const VIDEO_PATH = "/admin/flashcards";

const collectionSchema = z.object({
  courseId: z.uuid("Thiếu khóa học."),
  title: z.string().trim().min(1, "Nhập tên bộ video.").max(200),
  description: z.string().trim().max(500).optional(),
});

const saveVideosSchema = z.object({
  collectionId: z.uuid(),
  allowOverwrite: z.boolean().default(false),
  items: z
    .array(
      z.object({
        sessionNumber: z.number().int().positive(),
        // 🔴 Kiểm LẠI ở server dù client đã kiểm. Client là dữ liệu người dùng
        // gửi lên, không phải mã của mình đang chạy — đây là cửa ghi vào DB.
        youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Mã video không hợp lệ."),
        title: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .min(1, "Chưa có buổi nào để lưu.")
    .max(MAX_VIDEO_IMPORT_ROWS),
});

const publishSchema = z.object({
  collectionId: z.uuid(),
  status: z.enum(["draft", "published"]),
});

/** Tạo bộ video cho khoá. Bản đầu mỗi khoá một bộ, nhưng schema chừa nhiều bộ. */
export async function createVideoCollectionAction(
  input: unknown,
): Promise<ActionState & { collectionId?: string }> {
  await requireRole("super_admin");

  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("video_collections")
    .insert({
      course_id: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "video.collection.create",
    resourceType: "video_collection",
    resourceId: data.id,
    after: { course_id: parsed.data.courseId, title: parsed.data.title },
  });

  revalidatePath(VIDEO_PATH);
  return { success: "Đã tạo bộ video.", collectionId: data.id };
}

export type SaveVideosOutcome = {
  sessionNumber: number;
  status: "created" | "replaced" | "skipped";
  message?: string;
};

/**
 * Lưu cả lô link trong MỘT lượt gọi.
 *
 * Tiêu đề: ưu tiên chữ admin tự gõ; bỏ trống thì đi hỏi YouTube (user chốt
 * *"youtube để sao thì tiêu đề web để vậy"*); YouTube không trả lời thì rơi về
 * `"Buổi N"` — **fail-open, không chặn lượt nhập** vì lấy tiêu đề là tiện ích
 * chứ không phải luật nghiệp vụ.
 */
export async function saveLessonVideosAction(
  input: unknown,
): Promise<ActionState & { outcomes?: SaveVideosOutcome[] }> {
  await requireRole("super_admin");

  const parsed = saveVideosSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ." };
  }

  const { collectionId, allowOverwrite, items } = parsed.data;

  // Chỉ đi hỏi YouTube cho những buổi admin BỎ TRỐNG tiêu đề — admin đã gõ thì
  // chữ của admin thắng, và mỗi lời gọi tiết kiệm được là một chỗ bớt hỏng.
  const needTitle = items
    .filter((item) => !item.title?.trim())
    .map((item) => item.youtubeVideoId);
  const fetched = needTitle.length > 0 ? await fetchYoutubeTitles(needTitle) : new Map();

  const payload = items.map((item) => ({
    sessionNumber: item.sessionNumber,
    youtubeVideoId: item.youtubeVideoId,
    title:
      item.title?.trim() ||
      fetched.get(item.youtubeVideoId) ||
      `Buổi ${item.sessionNumber}`,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_lesson_videos", {
    p_collection_id: collectionId,
    p_items: payload,
    p_allow_overwrite: allowOverwrite,
  });

  if (error) return { error: dbErrorToMessage(error) };

  const outcomes = ((data as { outcomes?: SaveVideosOutcome[] } | null)?.outcomes ??
    []) as SaveVideosOutcome[];

  await logAudit(supabase, {
    action: "video.item.bulk_save",
    resourceType: "video_collection",
    resourceId: collectionId,
    after: { count: payload.length, allowOverwrite },
  });

  revalidatePath(VIDEO_PATH);
  revalidatePath("/student/review");

  const saved = outcomes.filter((row) => row.status !== "skipped").length;
  const skipped = outcomes.length - saved;

  return {
    success:
      skipped > 0
        ? `Đã lưu ${saved} buổi, bỏ qua ${skipped} buổi đã có video.`
        : `Đã lưu ${saved} buổi.`,
    outcomes,
  };
}

/** Công bố / gỡ công bố cả bộ. Gỡ công bố là đường để sửa lại link đã đăng. */
export async function setVideoCollectionStatusAction(
  input: unknown,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu chưa hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("video_collections")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.collectionId);

  if (error) return { error: dbErrorToMessage(error) };

  // Buổi đi theo bộ: công bố bộ thì công bố luôn các buổi trong đó. Để lệch hai
  // tầng thì admin bấm "Công bố" xong học viên vẫn thấy trống, không hiểu vì sao.
  const { error: itemError } = await supabase
    .from("video_items")
    .update({ status: parsed.data.status })
    .eq("collection_id", parsed.data.collectionId);

  if (itemError) return { error: dbErrorToMessage(itemError) };

  await logAudit(supabase, {
    action:
      parsed.data.status === "published"
        ? "video.collection.publish"
        : "video.collection.unpublish",
    resourceType: "video_collection",
    resourceId: parsed.data.collectionId,
    after: { status: parsed.data.status },
  });

  revalidatePath(VIDEO_PATH);
  revalidatePath("/student/review");

  return {
    success:
      parsed.data.status === "published"
        ? "Đã công bố bộ video cho học viên."
        : "Đã gỡ công bố. Học viên tạm thời không thấy bộ này.",
  };
}

/** Xoá một buổi khỏi bộ. Chỉ xoá liên kết — video vẫn còn trên YouTube. */
export async function deleteVideoItemAction(input: unknown): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = z.object({ itemId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu chưa hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("video_items")
    .delete()
    .eq("id", parsed.data.itemId);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "video.item.delete",
    resourceType: "video_item",
    resourceId: parsed.data.itemId,
  });

  revalidatePath(VIDEO_PATH);
  revalidatePath("/student/review");
  return { success: "Đã xóa liên kết. Video vẫn còn trên YouTube." };
}

/**
 * Lấy lại tiêu đề từ YouTube cho những buổi đã lưu.
 *
 * Có nút này vì user muốn *"youtube để sao thì tiêu đề web để vậy"* — mà đổi tên
 * bên YouTube thì web không tự biết. Hỏi lại mỗi lần render là 35 lời gọi ngoài
 * cho mỗi lượt mở trang, nên để thành một nút bấm khi cần.
 */
export async function refreshVideoTitlesAction(input: unknown): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = z.object({ collectionId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu chưa hợp lệ." };

  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("video_items")
    .select("id, youtube_video_id, session_number")
    .eq("collection_id", parsed.data.collectionId);

  if (error) return { error: dbErrorToMessage(error) };
  if (!items || items.length === 0) return { error: "Bộ này chưa có buổi nào." };

  const titles = await fetchYoutubeTitles(items.map((row) => row.youtube_video_id));
  if (titles.size === 0) {
    return { error: "Không lấy được tiêu đề nào từ YouTube. Thử lại sau." };
  }

  let updated = 0;
  for (const item of items) {
    const title = titles.get(item.youtube_video_id);
    if (!title) continue;
    const { error: updateError } = await supabase
      .from("video_items")
      .update({ title })
      .eq("id", item.id);
    if (!updateError) updated += 1;
  }

  await logAudit(supabase, {
    action: "video.item.refresh_titles",
    resourceType: "video_collection",
    resourceId: parsed.data.collectionId,
    after: { updated, total: items.length },
  });

  revalidatePath(VIDEO_PATH);
  revalidatePath("/student/review");

  return {
    success:
      updated === items.length
        ? `Đã cập nhật ${updated} tiêu đề từ YouTube.`
        : `Đã cập nhật ${updated}/${items.length} tiêu đề. Số còn lại YouTube không trả lời.`,
  };
}
