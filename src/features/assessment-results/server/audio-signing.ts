import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Đủ dài cho một lượt làm/thi mà không cần reload; URL vẫn là private signed.
const AUDIO_TTL_SECONDS = 6 * 60 * 60;

async function sign(
  supabase: Supabase,
  bucket: "question-media" | "answer-media",
  path: string,
): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, AUDIO_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

function audioPathOf(answer: unknown): string | null {
  if (answer && typeof answer === "object" && "audio_path" in answer) {
    const path = (answer as { audio_path?: unknown }).audio_path;
    return typeof path === "string" ? path : null;
  }
  return null;
}

type PayloadItem = {
  answer?: unknown;
  question?: {
    id?: string;
    type?: string;
    prompt_content?: Record<string, unknown> | null;
  };
};

/**
 * P-C — Ký signed URL cho audio trong payload lượt làm/thi:
 *  - Nghe/Chép: audio đề (`question_media` prompt_audio) → prompt_content.audio_url.
 *  - Nói: bản ghi HV đã nộp (`answer-media`) → answer.audio_url (nghe lại).
 * Mutate tại chỗ payload thô do RPC trả về (JSON tươi) rồi trả lại.
 */
export async function signAttemptPayloadAudio<T>(supabase: Supabase, payload: T): Promise<T> {
  const items = (payload as { items?: PayloadItem[] })?.items;
  if (!Array.isArray(items)) return payload;

  // 1) Audio đề cho câu Nghe/Chép.
  const audioVersionIds = [
    ...new Set(
      items
        .filter(
          (item) =>
            item.question?.id &&
            (item.question.type === "listening_choice" || item.question.type === "dictation"),
        )
        .map((item) => item.question!.id as string),
    ),
  ];
  if (audioVersionIds.length > 0) {
    const { data: media } = await supabase
      .from("question_media")
      .select("question_version_id,object_path")
      .in("question_version_id", audioVersionIds)
      .eq("media_role", "prompt_audio");
    const byVersion = new Map<string, string>();
    for (const row of media ?? []) byVersion.set(row.question_version_id, row.object_path);
    await Promise.all(
      items.map(async (item) => {
        const versionId = item.question?.id;
        const path = versionId ? byVersion.get(versionId) : undefined;
        if (!path || !item.question) return;
        const url = await sign(supabase, "question-media", path);
        if (url) {
          item.question.prompt_content = {
            ...(item.question.prompt_content ?? {}),
            audio_url: url,
          };
        }
      }),
    );
  }

  // 2) Bản ghi Nói đã nộp.
  await Promise.all(
    items.map(async (item) => {
      if (item.question?.type !== "speaking") return;
      const path = audioPathOf(item.answer);
      if (!path) return;
      const url = await sign(supabase, "answer-media", path);
      if (url) item.answer = { ...(item.answer as object), audio_url: url };
    }),
  );

  return payload;
}

type GradingAnswer = {
  answer_payload?: unknown;
  audio_url?: string | null;
  item?: { question_version?: { question_type?: string } | null } | null;
};
type GradingDelivery = {
  attempts?: Array<{ answers?: GradingAnswer[] | null } | null> | null;
} | null;

/**
 * P-C — Ký signed URL cho audio bài Nói ở màn chấm (giáo viên nghe rồi cho điểm).
 */
export async function signGradingAudio<T extends GradingDelivery>(
  supabase: Supabase,
  delivery: T,
): Promise<T> {
  const attempts = delivery?.attempts;
  if (!Array.isArray(attempts)) return delivery;
  const answers = attempts
    .flatMap((attempt) => attempt?.answers ?? [])
    .filter((answer) => answer.item?.question_version?.question_type === "speaking");
  await Promise.all(
    answers.map(async (answer) => {
      const path = audioPathOf(answer.answer_payload);
      if (!path) return;
      answer.audio_url = await sign(supabase, "answer-media", path);
    }),
  );
  return delivery;
}
