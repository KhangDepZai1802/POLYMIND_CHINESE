import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Ký nhiều object trong MỘT request thay vì N request.
 *
 * ⚠️ Vì sao tồn tại: `createSignedUrl` (số ít) là một HTTP call cho mỗi file.
 * Một trang 20 câu hỏi có audio = 20 kết nối tới Storage, và con số đó tăng
 * tuyến tính theo số câu/số học viên — đúng dạng N+1 đã liệt kê ở CLAUDE.md.
 * `createSignedUrls` (số nhiều) gộp toàn bộ path vào một request duy nhất.
 *
 * Trả về Map<object_path, signed_url>. Path ký lỗi bị bỏ khỏi Map (fail-closed:
 * caller thấy `undefined` → không phát sinh URL rác), không ném lỗi để một file
 * hỏng không đánh sập cả trang.
 */
export async function signPaths(
  supabase: Supabase,
  bucket:
    "question-media" | "answer-media" | "course-materials" | "flashcard-media",
  paths: ReadonlyArray<string | null | undefined>,
  expiresIn: number,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, expiresIn);

  if (error || !data) return new Map();

  const result = new Map<string, string>();
  for (const row of data) {
    // `path` có thể null khi Storage không ký được object đó.
    if (row.path && row.signedUrl && !row.error) {
      result.set(row.path, row.signedUrl);
    }
  }
  return result;
}
