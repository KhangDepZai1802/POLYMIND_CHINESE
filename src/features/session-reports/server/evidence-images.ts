import "server-only";

import sharp from "sharp";

import { createClient } from "@/lib/supabase/server";

import { EVIDENCE_BUCKET } from "../domain/evidence";
import type { ReportForRender } from "../domain/render";

/**
 * Nhị phân ảnh minh chứng, đã chuẩn hoá về định dạng Word NHÚNG ĐƯỢC.
 *
 * =============================================================================
 * 🔴 VÌ SAO PHẢI CHUYỂN ĐỊNH DẠNG
 * =============================================================================
 *
 * Ảnh minh chứng đi qua `compressFlashcardImage()` ở trình duyệt và ra **WebP**
 * (nhẹ hơn JPEG ~25–30%, giữ được nền trong suốt). Trình duyệt hiển thị WebP
 * ngon lành nên bản xem và bản in không cần đụng gì.
 *
 * Nhưng `docx` chỉ nhận `jpg | png | gif | bmp` (xem `RegularImageOptions` trong
 * kiểu của thư viện) — **không có WebP**. Nhét thẳng WebP vào là Word mở ra một
 * ô ảnh vỡ. Đó chính là lý do mục 8 trong file DOCX trước đây chỉ có mỗi dòng
 * chữ "3 tệp đính kèm" mà không có ảnh nào.
 *
 * Nên ở đây: đọc kiểu THẬT của tệp (không tin phần đuôi), giữ nguyên nếu Word
 * nhận được, còn lại thì chuyển — PNG khi ảnh có kênh trong suốt (chuyển sang
 * JPEG là nền trong suốt đổ đen), JPEG cho ảnh chụp thường (chuyển ảnh chụp
 * sang PNG làm file Word phình lên gấp nhiều lần).
 *
 * =============================================================================
 * FAIL-OPEN, CÓ CHỦ Ý
 * =============================================================================
 *
 * Mọi trục trặc — RLS chặn, file mất trong bucket, ảnh hỏng không giải mã được —
 * đều làm ảnh đó **vắng khỏi Map**, và `export-docx` in một dòng chữ nêu tên tệp
 * thay cho ảnh. Một tấm ảnh hỏng KHÔNG được phép đánh sập cả lượt xuất báo cáo
 * của giáo vụ. Đây là fail-open đúng chỗ: thứ đang hỏng là phần trình bày, không
 * phải phần phân quyền.
 */
export type EvidenceImage = {
  data: Buffer;
  /** Đúng union mà `ImageRun` của `docx` nhận. */
  type: "jpg" | "png";
  width: number;
  height: number;
};

/**
 * Cạnh dài tối đa khi nhúng vào Word.
 *
 * Ảnh đã được nén về ≤1280px lúc tải lên, nên đây gần như chỉ là chốt chặn cho
 * ảnh cũ / ảnh lọt qua đường nén fail-open. Một báo cáo tối đa 4 ảnh, một lượt
 * xuất tối đa 200 báo cáo — không giới hạn thì file Word thành vài trăm MB.
 */
const MAX_EDGE = 1200;

/** Cùng mốc chất lượng với bộ nén ở trình duyệt — mắt thường chưa thấy khác. */
const JPEG_QUALITY = 82;

/**
 * Tải và chuẩn hoá toàn bộ ảnh minh chứng của một lô báo cáo.
 *
 * Trả `Map<evidence.id, EvidenceImage>`. Khoá là `id` của hàng chứ không phải
 * đường dẫn: `export-docx` cầm trong tay `RenderEvidence`, và `id` là thứ không
 * bao giờ đổi kể cả khi file được chuyển chỗ trong bucket.
 *
 * ⚠️ Tải qua `createClient()` — client ĐÃ BỊ RLS THU HẸP theo người đang đăng
 * nhập, không phải service role. Giáo vụ xuất file thì đọc được (policy
 * `session_report_evidence_read` cho `app.is_manager()`); ai khác gọi vào thì
 * Storage trả lỗi và ảnh rơi khỏi Map — không có đường vòng nào ở tầng app.
 */
export async function loadEvidenceImages(
  reports: ReportForRender[],
): Promise<Map<string, EvidenceImage>> {
  const items = reports.flatMap((report) => report.evidence);
  const result = new Map<string, EvidenceImage>();
  if (items.length === 0) return result;

  const supabase = await createClient();

  // Tuần tự có chủ ý: giải mã ảnh là việc ngốn bộ nhớ, và một lượt xuất có thể
  // ôm 200 báo cáo × 4 ảnh. Mở tất cả cùng lúc là hàm serverless hết RAM —
  // cùng lý do với bộ nén ảnh ở trình duyệt.
  for (const item of items) {
    const image = await loadOne(supabase, item.storagePath);
    if (image) result.set(item.id, image);
  }

  return result;
}

async function loadOne(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<EvidenceImage | null> {
  try {
    const { data, error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .download(storagePath);

    if (error || !data) {
      console.error(
        `[session-reports] không tải được minh chứng ${storagePath}:`,
        error?.message ?? "không có dữ liệu",
      );
      return null;
    }

    const source = Buffer.from(await data.arrayBuffer());
    const meta = await sharp(source).metadata();

    // `hasAlpha` quyết định đích: JPEG không có kênh trong suốt, ép ảnh tách nền
    // sang JPEG là nền đổ ĐEN ngay giữa bản báo cáo gửi cấp trên.
    const keepAlpha = Boolean(meta.hasAlpha);
    const type: EvidenceImage["type"] = keepAlpha ? "png" : "jpg";

    const pipeline = sharp(source).rotate().resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });

    const { data: out, info } = await (
      keepAlpha ? pipeline.png() : pipeline.jpeg({ quality: JPEG_QUALITY })
    ).toBuffer({ resolveWithObject: true });

    return { data: out, type, width: info.width, height: info.height };
  } catch (cause) {
    console.error(
      `[session-reports] không xử lý được ảnh minh chứng ${storagePath}:`,
      cause instanceof Error ? cause.message : cause,
    );
    return null;
  }
}
