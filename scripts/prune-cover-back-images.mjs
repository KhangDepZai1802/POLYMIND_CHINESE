/**
 * DỌN ẢNH MẶT SAU MỒ CÔI CỦA TRANG MỞ ĐẦU (`COVER-1`/`D-41`).
 *
 * Migration `…084` đưa `back_image_path` của mọi trang mở đầu về `null` — nó bỏ
 * THAM CHIẾU chứ **không xoá file**. Đó là cố ý: file còn nằm trong bucket là cửa
 * khôi phục duy nhất nếu user đổi ý sau khi thấy kết quả thật. Script này là
 * bước hai, chạy khi đã chắc chắn.
 *
 * ⚠️ **MẶC ĐỊNH CHẠY KHÔ.** Không có `--apply` thì không xoá gì — chỉ in ra danh
 * sách file sẽ bị xoá kèm tổng dung lượng, để soi trước.
 *
 * 🔴 CÁCH NHẬN RA "MỒ CÔI", VÀ VÌ SAO NÓ HẸP ĐÚNG MỨC CẦN:
 * một object bị coi là mồ côi khi thoả **cả ba** vế —
 *   (1) tên file bắt đầu bằng `back-` (quy ước khe của `domain/media.ts`);
 *   (2) đoạn thứ tư của đường dẫn là `pageId` của một trang **`session_cover`**
 *       đang sống;
 *   (3) đường dẫn KHÔNG nằm trong `media_paths` của chính trang đó.
 * Vế (2) là thứ giữ cho script không bao giờ chạm vào ảnh mặt sau của thẻ từ
 * vựng cũ hay bất kỳ file lạ nào; vế (3) là thứ giữ cho nó không xoá nhầm khi
 * migration chưa chạy — lúc đó tham chiếu vẫn còn nên không có gì mồ côi và
 * script in ra `0`.
 *
 * ⛔ Cố ý KHÔNG viết thành "xoá mọi object không được tham chiếu": một object vừa
 * được tải lên qua vé ký nhưng chưa kịp gắn vào trang cũng không được tham chiếu,
 * và một bộ dọn rộng như vậy sẽ xoá đúng thứ người soạn đang chờ tải xong.
 *
 * Cách dùng:
 *   node scripts/prune-cover-back-images.mjs            # chạy khô, in danh sách
 *   node scripts/prune-cover-back-images.mjs --apply    # xoá thật
 *
 * Cần `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (đọc sẵn từ
 * `.env.local` nếu có). 🔴 Chạy với project NÀO thì xoá file của project ĐÓ.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "flashcard-media";

const apply = process.argv.includes("--apply");

function loadEnvLocal() {
  const path = resolve(
    fileURLToPath(new URL("..", import.meta.url)),
    ".env.local",
  );
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key]) continue;
    process.env[key] = value.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Chạy lên cloud thì đặt thẳng ở dòng lệnh để không dính .env.local của máy dev.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// =====================================================================
// Liệt kê bucket
// =====================================================================

async function listAll(prefix = "") {
  const found = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw new Error(`Không liệt kê được "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // `id` chỉ có ở object thật; thư mục ảo thì null.
      if (entry.id) found.push({ path, size: entry.metadata?.size ?? 0 });
      else found.push(...(await listAll(path)));
    }
    if (data.length < pageSize) break;
  }
  return found;
}

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// =====================================================================
// Chạy
// =====================================================================

const objects = await listAll();

// Chỉ giữ object mang khe `back` — quy ước đường dẫn là
// `actor/deck/section/page/back-<uuid>.<ext>` (`domain/media.ts`).
const candidates = objects.filter((item) => {
  const segments = item.path.split("/");
  if (segments.length !== 5) return false;
  return /^back-[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(segments[4]);
});

if (candidates.length === 0) {
  console.log("Không có object nào mang khe `back` trong bucket. Không cần dọn.");
  process.exit(0);
}

const pageIds = [...new Set(candidates.map((item) => item.path.split("/")[3]))];

// Tra ngược từ `pageId`. Chỉ trang mở đầu ĐANG SỐNG mới nằm trong phạm vi dọn;
// trang đã lưu trữ do `archive_flashcard_page` lo dọn theo đường riêng của nó.
const pageById = new Map();
const chunkSize = 200;
for (let start = 0; start < pageIds.length; start += chunkSize) {
  const { data, error } = await supabase
    .from("flashcard_pages")
    .select("id,kind,media_paths,archived_at")
    .in("id", pageIds.slice(start, start + chunkSize));
  if (error) {
    console.error(`Không đọc được flashcard_pages: ${error.message}`);
    process.exit(1);
  }
  for (const page of data ?? []) pageById.set(page.id, page);
}

const orphans = [];
const kept = [];
for (const item of candidates) {
  const pageId = item.path.split("/")[3];
  const page = pageById.get(pageId);
  if (!page || page.kind !== "session_cover" || page.archived_at !== null) {
    kept.push({ ...item, why: "không thuộc trang mở đầu đang sống" });
    continue;
  }
  if ((page.media_paths ?? []).includes(item.path)) {
    // Migration `…084` chưa chạy trên project này, hoặc file vẫn đang được dùng.
    kept.push({ ...item, why: "trang vẫn đang tham chiếu (migration …084 chưa áp?)" });
    continue;
  }
  orphans.push(item);
}

const totalBytes = orphans.reduce((sum, item) => sum + item.size, 0);

console.log(`Object mang khe \`back\`: ${candidates.length}`);
console.log(`  • mồ côi, sẽ xoá: ${orphans.length} (${mb(totalBytes)})`);
console.log(`  • giữ lại:        ${kept.length}`);

for (const item of kept) {
  console.log(`    giữ  ${item.path} — ${item.why}`);
}
for (const item of orphans) {
  console.log(`    xoá  ${item.path} — ${mb(item.size)}`);
}

if (orphans.length === 0) {
  console.log("\nKhông có gì để dọn.");
  process.exit(0);
}

if (!apply) {
  console.log(
    "\nĐây là bản CHẠY KHÔ — chưa xoá gì.\n" +
      "Soi danh sách trên, nếu đúng thì chạy lại với `--apply`.\n" +
      "⚠️ Xoá xong KHÔNG khôi phục được: đây là bản duy nhất của ảnh mặt sau cũ.",
  );
  process.exit(0);
}

// Xoá theo lô: `remove()` nhận mảng, nhưng lô quá to thì một lỗi mạng làm hỏng
// cả lượt mà không biết đã xoá tới đâu.
let removed = 0;
const batchSize = 50;
for (let start = 0; start < orphans.length; start += batchSize) {
  const batch = orphans.slice(start, start + batchSize).map((item) => item.path);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) {
    console.error(`\nLỗi khi xoá lô bắt đầu ở ${start}: ${error.message}`);
    console.error(`Đã xoá ${removed} file trước đó. Chạy lại để dọn nốt.`);
    process.exit(1);
  }
  removed += batch.length;
  console.log(`Đã xoá ${removed}/${orphans.length}…`);
}

console.log(`\nXong. Đã xoá ${removed} file (${mb(totalBytes)}).`);
