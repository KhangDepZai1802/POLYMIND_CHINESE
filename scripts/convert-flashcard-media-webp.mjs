/**
 * ĐỔI ẢNH FLASHCARD SANG WEBP (`PERF-IMG-2`) — cả byte trong bucket lẫn đường
 * dẫn trong DB.
 *
 * VÌ SAO CÓ SCRIPT THỨ HAI: `compress-flashcard-media.mjs` cố ý **giữ nguyên
 * định dạng** để khỏi phải đụng vào DB. Đo trên ảnh production thật mới thấy cái
 * giá của lựa chọn đó — ảnh của khoá này là **đồ hoạ phẳng**, thứ PNG lưu cực kỳ
 * lãng phí:
 *
 *   PNG gốc 3.770 KB → giữ PNG: 748 KB (−80%) → **WebP: 27 KB (−99,3%)**
 *
 * 140 lần nhẹ hơn thay vì 5 lần. Đó là khác biệt giữa "đỡ chậm" và "hiện ra ngay".
 *
 * ⚠️ **MẶC ĐỊNH CHẠY KHÔ.** Không có `--apply` thì không ghi, không xoá, không
 * gọi RPC — chỉ tải về nén thử rồi in số.
 *
 * THỨ TỰ AN TOÀN, mỗi bước chỉ làm khi bước trước đã chắc chắn:
 *   1. tải ảnh cũ → nén WebP trong bộ nhớ;
 *   2. **tải file mới lên** (đường dẫn chỉ khác phần đuôi) — file cũ vẫn nguyên;
 *   3. gọi RPC đổi đường dẫn trong DB (một transaction, tự hạ/nâng trạng thái buổi);
 *   4. **chỉ xoá file cũ mà RPC xác nhận đã đổi.**
 * Đứt ở bước 1–2: không có gì thay đổi. Đứt ở bước 3: DB chưa đổi, file mới thừa
 * lại nhưng vô hại, chạy lại là xong. Đứt ở bước 4: chỉ còn rác, thẻ vẫn đúng.
 *
 * Cách dùng:
 *   node scripts/convert-flashcard-media-webp.mjs                # chạy khô
 *   node scripts/convert-flashcard-media-webp.mjs --apply        # làm thật
 *   node scripts/convert-flashcard-media-webp.mjs --limit=5      # thử 5 ảnh
 *   node scripts/convert-flashcard-media-webp.mjs --keep-old     # không xoá file cũ
 *
 * Cần `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (đọc sẵn từ
 * `.env.local` nếu có). 🔴 Chạy với project NÀO thì sửa dữ liệu của project ĐÓ.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "flashcard-media";
const CACHE_CONTROL = "31536000";
const CONVERTIBLE = new Set(["jpg", "jpeg", "png"]);

function readFlag(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = Number(hit.slice(name.length + 3));
  return Number.isFinite(value) ? value : fallback;
}

const apply = process.argv.includes("--apply");
const keepOld = process.argv.includes("--keep-old");
const maxEdge = readFlag("max-edge", 1280);
const quality = readFlag("quality", 82);
const limit = readFlag("limit", Infinity);
/** 6 luồng: đủ nhanh mà không làm nghẽn đường truyền của chính máy đang chạy. */
const concurrency = Math.max(1, readFlag("concurrency", 6));

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
  console.error("Không nạp được `sharp`. Cài bằng: npm install --save-dev sharp");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// =====================================================================
// Liệt kê
// =====================================================================

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
      if (entry.id) found.push(path);
      else found.push(...(await listAll(path)));
    }
    if (data.length < pageSize) break;
  }
  return found;
}

function extensionOf(path) {
  return (path.split(".").at(-1) ?? "").toLowerCase();
}

function webpPathOf(path) {
  return path.replace(/\.[A-Za-z0-9]+$/, ".webp");
}

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// =====================================================================
// Chạy
// =====================================================================

/*
 * KIỂM TRA TRƯỚC: RPC đã có trên project này chưa.
 *
 * Gọi với bảng tra RỖNG — hàm nhận `{}` rồi trả `[]` ngay, không đụng vào một
 * hàng dữ liệu nào. Không có bước này thì máy phải tải cả GB ảnh về, nén, tải
 * lên, rồi mới đâm vào lỗi "không tìm thấy hàm" ở bước cuối vì migration `…082`
 * chưa được đẩy lên cloud.
 */
if (apply) {
  const { error } = await supabase.rpc("rewrite_flashcard_media_extension", {
    p_mapping: {},
  });
  if (error) {
    console.error(
      `Chưa gọi được RPC đổi đường dẫn trên project này:\n  ${error.message}\n\n` +
        "Hãy đẩy migration 20260728000082_flashcard_media_extension_rewrite.sql lên trước\n" +
        "(`npx supabase db push`, hoặc dán thẳng file đó vào Dashboard → SQL Editor).",
    );
    process.exit(1);
  }
}

const all = await listAll();
const targets = all
  .filter((path) => CONVERTIBLE.has(extensionOf(path)))
  .slice(0, limit);

console.log(
  `Bucket ${BUCKET}: ${all.length} object · ${targets.length} ảnh cần đổi sang WebP\n` +
    `Chế độ: ${apply ? "🔴 LÀM THẬT" : "chạy khô (không ghi, không xoá)"} · ` +
    `cạnh dài ≤ ${maxEdge}px · chất lượng ${quality} · ${concurrency} luồng\n` +
    `⏳ Phải TẢI VỀ từng ảnh mới nén được, nên lượt chạy này tốn băng thông thật.\n`,
);

let totalBefore = 0;
let totalAfter = 0;
let converted = 0;
let skipped = 0;
const failures = [];

const mapping = {};
const sizeByPath = new Map();
let processed = 0;

/**
 * Một ảnh: tải về → nén → (nếu `--apply`) tải bản mới lên.
 *
 * In tiến độ TỪNG ẢNH. Bản đầu im lặng suốt cả lượt chạy, và với 312 ảnh × ~3,8MB
 * (≈1,2GB tải về) thì "im lặng" trông y hệt "treo máy" — user đã phải ngồi đoán
 * mất 10 phút. Việc chạy lâu là không tránh được; việc KHÔNG BIẾT nó đang chạy
 * thì tránh được.
 */
async function convertOne(path) {
  const label = path.split("/").at(-1) ?? path;
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    failures.push(`${path} — tải về lỗi: ${error?.message ?? "?"}`);
    processed += 1;
    return;
  }
  const input = Buffer.from(await data.arrayBuffer());

  let output;
  try {
    output = await sharp(input)
      // Áp cờ xoay EXIF TRƯỚC khi thu nhỏ; thiếu bước này ảnh chụp dọc sẽ nằm ngang.
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  } catch (cause) {
    failures.push(`${path} — không nén được: ${cause}`);
    processed += 1;
    return;
  }

  processed += 1;
  const counter = `[${String(processed).padStart(3)}/${targets.length}]`;

  if (output.length >= input.length) {
    skipped += 1;
    console.log(`  ${counter} giữ nguyên (WebP không nhẹ hơn) — ${label.slice(0, 44)}`);
    return;
  }

  totalBefore += input.length;
  totalAfter += output.length;
  sizeByPath.set(path, { before: input.length, after: output.length });

  const newPath = webpPathOf(path);
  if (apply) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, output, {
        upsert: true,
        contentType: "image/webp",
        cacheControl: CACHE_CONTROL,
      });
    if (uploadError) {
      failures.push(`${newPath} — tải lên lỗi: ${uploadError.message}`);
      return;
    }
  }
  mapping[path] = newPath;
  converted += 1;
  console.log(
    `  ${counter} ${(input.length / 1024 / 1024).toFixed(2)}MB → ` +
      `${(output.length / 1024).toFixed(0)}KB  ${label.slice(0, 40)}`,
  );
}

// Tải song song có trần. Tuần tự thì 312 ảnh nối đuôi nhau qua đường truyền nhà
// — chậm gấp mấy lần mà không an toàn hơn chút nào, vì mỗi ảnh là một thao tác
// độc lập và bước ghi DB chỉ diễn ra MỘT lần, sau khi tất cả đã xong.
const queue = [...targets];
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const path = queue.shift();
      if (path) await convertOne(path);
    }
  }),
);

// MỘT lượt gọi cho toàn bộ bảng tra: RPC tự tra ngược từ `media_paths` ra những
// buổi liên quan, tự hạ/nâng trạng thái từng buổi, và tất cả nằm trong MỘT
// transaction — không có trạng thái nửa vời nào lọt ra ngoài.
const mappedCount = Object.keys(mapping).length;
let appliedPaths = [];

if (apply && mappedCount > 0) {
  const { data: applied, error: rpcError } = await supabase.rpc(
    "rewrite_flashcard_media_extension",
    { p_mapping: mapping },
  );

  if (rpcError) {
    failures.push(`RPC đổi đường dẫn lỗi: ${rpcError.message}`);
    console.log("  🔴 DB KHÔNG đổi — file cũ giữ nguyên, chạy lại được");
  } else {
    appliedPaths = Array.isArray(applied) ? applied : [];
    const orphans = Object.keys(mapping).filter((path) => !appliedPaths.includes(path));

    if (!keepOld) {
      // Chỉ xoá file cũ mà DB đã xác nhận trỏ sang bản mới.
      for (let start = 0; start < appliedPaths.length; start += 50) {
        await supabase.storage.from(BUCKET).remove(appliedPaths.slice(start, start + 50));
      }
      // File mới vừa tạo cho object KHÔNG trang nào dùng: dọn luôn, đừng để rác.
      const orphanCopies = orphans.map(webpPathOf);
      for (let start = 0; start < orphanCopies.length; start += 50) {
        await supabase.storage.from(BUCKET).remove(orphanCopies.slice(start, start + 50));
      }
    }

    const savedBytes = appliedPaths.reduce(
      (sum, path) =>
        sum + ((sizeByPath.get(path)?.before ?? 0) - (sizeByPath.get(path)?.after ?? 0)),
      0,
    );
    console.log(
      `  ✅ ${appliedPaths.length} ảnh đã đổi đường dẫn trong DB` +
        (orphans.length > 0
          ? ` · ${orphans.length} file mồ côi (không trang nào dùng — đã dọn bản mới)`
          : "") +
        ` · nhẹ đi ${mb(savedBytes)}`,
    );
  }
}

console.log(`
=====================================================
Đổi sang WebP: ${converted} ảnh
Bỏ qua:        ${skipped} ảnh (WebP không nhẹ hơn)
Lỗi:           ${failures.length}
Trước:         ${mb(totalBefore)}
Sau:           ${mb(totalAfter)}
Tiết kiệm:     ${mb(totalBefore - totalAfter)} (${
  totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0
}%)
=====================================================`);

for (const failure of failures) console.error(`  🔴 ${failure}`);

if (!apply && converted > 0) {
  console.log("\nĐây mới là chạy khô. Thêm --apply để làm thật.");
}
