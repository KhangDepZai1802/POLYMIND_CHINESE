import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Đủ dài cho một lượt làm/thi mà không cần reload; URL vẫn là private signed.
const AUDIO_TTL_SECONDS = 6 * 60 * 60;

/** Ký toàn bộ bản ghi Nói của một lượt trong MỘT request. */
function signAnswerMedia(supabase: Supabase, paths: Array<string | null>) {
  return signPaths(supabase, "answer-media", paths, AUDIO_TTL_SECONDS);
}

function audioPathOf(answer: unknown): string | null {
  if (answer && typeof answer === "object" && "audio_path" in answer) {
    const path = (answer as { audio_path?: unknown }).audio_path;
    return typeof path === "string" ? path : null;
  }
  return null;
}

const PROMPT_AUDIO_TYPES = new Set(["listening_choice", "dictation"]);

async function getSignedPromptAudioByVersion(
  supabase: Supabase,
  versionIds: Array<string | undefined>,
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(versionIds.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();

  const { data: media } = await supabase
    .from("question_media")
    .select("question_version_id,object_path")
    .in("question_version_id", uniqueIds)
    .eq("media_role", "prompt_audio");

  // Một request ký toàn bộ audio đề, thay vì một request mỗi câu.
  const urlByPath = await signPaths(
    supabase,
    "question-media",
    (media ?? []).map((row) => row.object_path),
    AUDIO_TTL_SECONDS,
  );

  const byVersion = new Map<string, string>();
  for (const row of media ?? []) {
    const url = urlByPath.get(row.object_path);
    if (url) byVersion.set(row.question_version_id, url);
  }
  return byVersion;
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
  const promptAudioByVersion = await getSignedPromptAudioByVersion(
    supabase,
    items
      .filter((item) => PROMPT_AUDIO_TYPES.has(item.question?.type ?? ""))
      .map((item) => item.question?.id),
  );
  for (const item of items) {
    const versionId = item.question?.id;
    const url = versionId ? promptAudioByVersion.get(versionId) : undefined;
    if (url && item.question) {
      item.question.prompt_content = {
        ...(item.question.prompt_content ?? {}),
        audio_url: url,
      };
    }
  }

  // 2) Bản ghi Nói đã nộp — gộp một request cho cả lượt.
  const speakingItems = items.filter((item) => item.question?.type === "speaking");
  const answerUrls = await signAnswerMedia(
    supabase,
    speakingItems.map((item) => audioPathOf(item.answer)),
  );
  for (const item of speakingItems) {
    const path = audioPathOf(item.answer);
    const url = path ? answerUrls.get(path) : undefined;
    if (url) item.answer = { ...(item.answer as object), audio_url: url };
  }

  return payload;
}

type GradingAnswer = {
  answer_payload?: unknown;
  audio_url?: string | null;
  prompt_audio_url?: string | null;
  item?: {
    question_version?: {
      id?: string;
      question_type?: string;
    } | null;
  } | null;
};
type GradingDelivery = {
  attempts?: Array<{ answers?: GradingAnswer[] | null } | null> | null;
} | null;

/**
 * P-C — Ký cả audio đề và bản ghi Nói ở màn chấm.
 */
export async function signGradingAudio<T extends GradingDelivery>(
  supabase: Supabase,
  delivery: T,
): Promise<T> {
  const attempts = delivery?.attempts;
  if (!Array.isArray(attempts)) return delivery;
  const answers = attempts.flatMap((attempt) => attempt?.answers ?? []);
  const promptAudioByVersion = await getSignedPromptAudioByVersion(
    supabase,
    answers
      .filter((answer) =>
        PROMPT_AUDIO_TYPES.has(answer.item?.question_version?.question_type ?? ""),
      )
      .map((answer) => answer.item?.question_version?.id),
  );

  for (const answer of answers) {
    const versionId = answer.item?.question_version?.id;
    answer.prompt_audio_url = versionId ? (promptAudioByVersion.get(versionId) ?? null) : null;
  }

  // Màn chấm gom bản ghi Nói của TẤT CẢ học viên trong lượt giao bài — đây là
  // chỗ N+1 đau nhất khi lớp đông. Ký toàn bộ trong một request.
  const speakingAnswers = answers.filter(
    (answer) => answer.item?.question_version?.question_type === "speaking",
  );
  const answerUrls = await signAnswerMedia(
    supabase,
    speakingAnswers.map((answer) => audioPathOf(answer.answer_payload)),
  );
  for (const answer of speakingAnswers) {
    const path = audioPathOf(answer.answer_payload);
    answer.audio_url = path ? (answerUrls.get(path) ?? null) : null;
  }
  return delivery;
}

type PublishedResult = {
  answers?: Array<{
    question_version_id?: string;
    question_type?: string;
    prompt_content?: Record<string, unknown> | null;
    answer?: unknown;
    prompt_audio_url?: string | null;
    audio_url?: string | null;
  }> | null;
} | null;

/** Ký cả audio đề và bản ghi Nói trên trang kết quả của chính học viên. */
export async function signPublishedResultAudio<T>(
  supabase: Supabase,
  result: T,
): Promise<T> {
  const publishedResult = result as PublishedResult;
  const answers = publishedResult?.answers ?? [];
  const promptAudioByVersion = await getSignedPromptAudioByVersion(
    supabase,
    answers
      .filter((answer) => PROMPT_AUDIO_TYPES.has(answer.question_type ?? ""))
      .map((answer) => answer.question_version_id),
  );

  for (const answer of answers) {
    answer.prompt_audio_url = answer.question_version_id
      ? (promptAudioByVersion.get(answer.question_version_id) ?? null)
      : null;
  }

  const speakingAnswers = answers.filter((answer) => answer.question_type === "speaking");
  const answerUrls = await signAnswerMedia(
    supabase,
    speakingAnswers.map((answer) => audioPathOf(answer.answer)),
  );
  for (const answer of speakingAnswers) {
    const path = audioPathOf(answer.answer);
    if (path) answer.audio_url = answerUrls.get(path) ?? null;
  }
  return result;
}
