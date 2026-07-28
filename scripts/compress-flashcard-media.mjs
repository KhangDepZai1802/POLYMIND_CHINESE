/**
 * NÉN LẠI ẢNH FLASHCARD ĐÃ NẰM TRONG BUCKET (`PERF-IMG-1`, tầng A3).
 *
 * Từ đợt này ảnh MỚI đã được nén ngay trên máy admin trước khi tải lên
 * (`src/features/flashcards/client/compress-image.ts`). Script này lo phần còn
 * lại: kho ảnh cũ — thứ mà học viên đang phải tải nguyên bản gốc mỗi lần lướt thẻ.
 *
 * ⚠️ **MẶC ĐỊNH CHẠY KHÔ.** Không có `--apply` thì script chỉ tải về, nén thử
 * trong bộ nhớ rồi in ra con số tiết kiệm được — không ghi một byte nào lên
 * bucket. Đó cũng là cách lấy SỐ ĐO trước/sau mà không phải đánh cược gì.
 *
 * 🔴 **GIỮ NGUYÊN ĐỊNH DẠNG, GHI ĐÈ ĐÚNG ĐƯỜNG DẪN CŨ.** Không đổi `.jpg` thành
 * `.webp` dù WebP nhẹ hơn, vì đường dẫn object nằm trong `flashcard_pages`
 * (`front_image_path`, `media_paths`…) và cả policy Storage. Đổi đuôi file là
 * phải sửa dữ liệu ở DB trong cùng một nhịp — rủi ro không cân với phần nhẹ
 * thêm được, khi mà riêng việc thu cạnh dài về 1280px đã cắt ~85% số điểm ảnh.
 *
 * Cách dùng:
 *   node scripts/compress-flashcard-media.mjs                  # chạy khô, chỉ đo
 *   node scripts/compress-flashcard-media.mjs --apply          # ghi đè thật
 *   node scripts/compress-flashcard-media.mjs --limit=20       # thử 20 file đầu
 *   node scripts/compress-flashcard-media.mjs --max-edge=1600 --quality=85
 *
 * Cần hai biến môi trường (đọc sẵn từ `.env.local` nếu có):
 *   NEXT_PUBLIC_SUPABASE_URL   — hoặc SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  — 🔴 chạy với project NÀO thì sửa ảnh của project ĐÓ
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "flashcard-media";
const CACHE_CONTROL = "31536000";
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

// =====================================================================
// Tham số
// =====================================================================

function readFlag(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

const apply = process.argv.includes("--apply");
const maxEdge = readFlag("max-edge", 1280);
const quality = readFlag("quality", 82);
const limit = readFlag("limit", Infinity);
const concurrency = readFlag("concurrency", 4);

// =====================================================================
// Môi trường
// =====================================================================

/**
 * Nạp `.env.local` cho các biến CHƯA có sẵn.
 *
 * Biến đặt thẳng ở dòng lệnh vì thế luôn thắng — đó là đường chạy script này
 * lên project cloud trong khi `.env.local` vẫn đang trỏ về Supabase local.
 */
function loadEnvLocal() {
  const path = resolve(fileURLToPath(new URL("..", import.meta.url)), ".env.local");
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

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error(
    "Không nạp được `sharp`. Cài bằng: npm install --save-dev sharp\n" +
      "(Next kéo sẵn `sharp` cho khâu tối ưu ảnh, nhưng đừng dựa vào phụ thuộc gián tiếp đó.)",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// =====================================================================
// Liệt kê object
// =====================================================================

/**
 * Đi hết cây thư mục của bucket.
 *
 * Đường dẫn có 5 tầng (`actor/deck/section/page/file`) nhưng script không giả
 * định con số đó: thư mục là mục **không có `id`**, cứ thấy là đi tiếp. Ghim
 * cứng độ sâu là thứ sẽ hỏng lặng lẽ nếu quy ước đường dẫn đổi.
 */
async function listAll(prefix = "") {
  const found = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Không liệt kê được "${prefix}": ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) found.push({ path, size: entry.metadata?.size ?? 0 });
      else found.push(...(await listAll(path)));
    }
    if (data.length < pageSize) break;
  }
  return found;
}

// =====================================================================
// Nén một file
// =====================================================================

function extensionOf(path) {
  return (path.split(".").at(-1) ?? "").toLowerCase();
}

function encoderFor(extension, pipeline) {
  if (extension === "png") return pipeline.png({ compressionLevel: 9 });
  if (extension === "webp") return pipeline.webp({ quality });
  // `mozjpeg`: cùng chất lượng nhìn thấy nhưng nhỏ hơn ~10% so với encoder mặc định.
  return pipeline.jpeg({ quality, mozjpeg: true });
}

const CONTENT_TYPE = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

async function processOne(object) {
  const extension = extensionOf(object.path);
  const { data, error } = await supabase.storage.from(BUCKET).download(object.path);
  if (error || !data) {
    return { path: object.path, state: "error", reason: error?.message ?? "tải về lỗi" };
  }

  const input = Buffer.from(await data.arrayBuffer());
  let output;
  try {
    output = await encoderFor(
      extension,
      // `.rotate()` không tham số = áp cờ xoay trong EXIF rồi mới thu nhỏ. Thiếu
      // bước này thì ảnh chụp dọc bằng điện thoại sẽ NẰM NGANG sau khi nén —
      // trình duyệt vốn tự xoay theo EXIF, còn sharp thì không.
      sharp(input).rotate().resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      }),
    ).toBuffer();
  } catch (cause) {
    return { path: object.path, state: "error", reason: String(cause) };
  }

  // Nén xong mà to hơn thì giữ nguyên bản cũ — ảnh đồ hoạ phẳng dạng PNG hoàn
  // toàn có thể phình ra khi mã hoá lại.
  if (output.length >= input.length) {
    return { path: object.path, state: "kept", before: input.length, after: input.length };
  }

  if (apply) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(object.path, output, {
        upsert: true,
        contentType: CONTENT_TYPE[extension],
        cacheControl: CACHE_CONTROL,
      });
    if (uploadError) {
      return { path: object.path, state: "error", reason: uploadError.message };
    }
  }

  return {
    path: object.path,
    state: "compressed",
    before: input.length,
    after: output.length,
  };
}

/**
 * Thống kê theo ĐỊNH DẠNG — để trả lời đúng một câu hỏi nghiệp vụ: *"tôi đã
 * upload xong rồi, có phải làm lại không?"*
 *
 * Script này giữ nguyên định dạng, nên JPEG cũ nén xuống rất sâu (còn ~200–300KB)
 * trong khi PNG chỉ giảm được phần điểm ảnh (còn ~1MB). Biết kho ảnh nghiêng về
 * bên nào mới biết có đáng làm bước PNG→WebP tiếp theo hay không.
 */
function breakdownByExtension(results) {
  const groups = new Map();
  for (const item of results) {
    if (item.state === "error") continue;
    const extension = extensionOf(item.path);
    const group = groups.get(extension) ?? { count: 0, before: 0, after: 0 };
    group.count += 1;
    group.before += item.before;
    group.after += item.after;
    groups.set(extension, group);
  }
  return groups;
}

// =====================================================================
// Chạy
// =====================================================================

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const all = await listAll();
const images = all
  .filter((object) => IMAGE_EXTENSIONS.has(extensionOf(object.path)))
  .slice(0, limit);

console.log(
  `Bucket ${BUCKET}: ${all.length} object, ${images.length} ảnh sẽ xử lý.\n` +
    `Chế độ: ${apply ? "🔴 GHI ĐÈ THẬT" : "chạy khô (không ghi gì)"} · cạnh dài ≤ ${maxEdge}px · chất lượng ${quality}\n`,
);

const results = [];
for (let start = 0; start < images.length; start += concurrency) {
  const batch = images.slice(start, start + concurrency);
  results.push(...(await Promise.all(batch.map(processOne))));
  console.log(`  … ${Math.min(start + concurrency, images.length)}/${images.length}`);
}

const compressed = results.filter((item) => item.state === "compressed");
const kept = results.filter((item) => item.state === "kept");
const failed = results.filter((item) => item.state === "error");

const before = [...compressed, ...kept].reduce((sum, item) => sum + item.before, 0);
const after = [...compressed, ...kept].reduce((sum, item) => sum + item.after, 0);

console.log(`
=====================================================
Đã nén:     ${compressed.length} ảnh
Giữ nguyên: ${kept.length} ảnh (nén lại không nhẹ hơn)
Lỗi:        ${failed.length} ảnh
Trước:      ${mb(before)}
Sau:        ${mb(after)}
Tiết kiệm:  ${mb(before - after)} (${before > 0 ? Math.round((1 - after / before) * 100) : 0}%)
=====================================================`);

console.log("Theo định dạng:");
for (const [extension, group] of breakdownByExtension(results)) {
  const saved = group.before > 0 ? Math.round((1 - group.after / group.before) * 100) : 0;
  const average = group.after / group.count / 1024;
  console.log(
    `  .${extension.padEnd(5)} ${String(group.count).padStart(4)} ảnh · ` +
      `${mb(group.before)} → ${mb(group.after)} (−${saved}%) · ` +
      `trung bình còn ${average.toFixed(0)} KB/ảnh`,
  );
}

// Ngưỡng 400KB: trên mức đó thì trên 4G vẫn còn thấy chờ, và nguyên nhân gần
// như luôn là PNG — thứ mà script này (cố ý giữ định dạng) không chữa hết được.
const heavy = [...breakdownByExtension(results)].filter(
  ([, group]) => group.after / group.count > 400 * 1024,
);
if (heavy.length > 0) {
  console.log(
    `\n⚠️  ${heavy.map(([extension]) => `.${extension}`).join(", ")} sau khi nén vẫn > 400KB/ảnh.\n` +
      "   Đây là trần của việc giữ nguyên định dạng. Muốn nhẹ hơn nữa thì phải đổi\n" +
      "   sang WebP, mà đổi đuôi file thì phải sửa đường dẫn trong DB — task riêng,\n" +
      "   KHÔNG phải upload lại bằng tay.",
  );
}

for (const item of failed) {
  console.error(`  🔴 ${item.path} — ${item.reason}`);
}

if (!apply && compressed.length > 0) {
  console.log("\nĐây mới là chạy khô. Thêm --apply để ghi đè thật.");
}
