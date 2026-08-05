import "server-only";

/**
 * Lấy tiêu đề video từ YouTube qua oEmbed (`VIDEO-1c`).
 *
 * User chốt 2026-08-05: *"tiêu đề lấy từ youtube, youtube để sao thì tiêu đề web
 * để vậy"*. oEmbed là endpoint **công khai, không cần API key**, nên không phải
 * xin credential và không có gì để rò.
 *
 * 🔴 **FAIL-OPEN, và đây là quyết định có chủ ý.** Lấy tiêu đề là việc *tiện
 * lợi*, không phải việc *đúng/sai nghiệp vụ*. YouTube chậm hay chặn thì admin
 * vẫn phải nhập được link — nên mọi lỗi đều rơi về `null` để caller dùng
 * `"Buổi N"`, tuyệt đối không ném ra chặn cả lượt nhập.
 *
 * ⚠️ **Chưa kiểm được trên video chế độ "Không công khai"** (phiên 97 không có
 * mẫu để thử). Đã đo: video công khai → 200 / ~236ms + đúng tiêu đề; ID không
 * tồn tại → 400; ID sai độ dài → 400. Theo thiết kế của YouTube thì oEmbed đọc
 * được video unlisted (chỉ *Riêng tư* mới bị chặn), nhưng **chưa có bằng chứng
 * tự tay đo**. Nếu hoá ra không đọc được thì fail-open ở trên khiến hậu quả chỉ
 * là "tiêu đề mặc định Buổi N", không phải hỏng tính năng.
 */

/** Ngắn thôi: admin đang ngồi chờ, mà đây chỉ là tiện ích. */
const OEMBED_TIMEOUT_MS = 5000;

/** Bao nhiêu lời gọi cùng lúc. Đủ nhanh cho 35 buổi, không nện YouTube một phát. */
const OEMBED_CONCURRENCY = 6;

type OEmbedResponse = { title?: unknown };

/** Trả tiêu đề, hoặc `null` nếu vì bất kỳ lý do gì không lấy được. */
export async function fetchYoutubeTitle(videoId: string): Promise<string | null> {
  const target = new URL("https://www.youtube.com/oembed");
  target.searchParams.set("url", `https://youtu.be/${videoId}`);
  target.searchParams.set("format", "json");

  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
      // Tiêu đề đổi rất hiếm; để Next nhớ 1 giờ thì nhập lại lô 35 buổi không
      // bắn thêm 35 request nữa.
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const payload: OEmbedResponse = await response.json();
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    return title === "" ? null : title;
  } catch {
    // Hết giờ, mất mạng, JSON hỏng — tất cả đều là "không lấy được", không phải
    // "nhập thất bại".
    return null;
  }
}

/**
 * Lấy tiêu đề cho cả lô, chạy theo từng nhóm nhỏ.
 *
 * Trả `Map<videoId, title>`; ID nào không lấy được thì **vắng mặt** trong Map
 * chứ không nằm đó với giá trị rỗng — caller thấy `undefined` là biết phải dùng
 * tên mặc định.
 */
export async function fetchYoutubeTitles(
  videoIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(videoIds)];
  const result = new Map<string, string>();

  for (let index = 0; index < unique.length; index += OEMBED_CONCURRENCY) {
    const batch = unique.slice(index, index + OEMBED_CONCURRENCY);
    const titles = await Promise.all(
      batch.map(async (videoId) => [videoId, await fetchYoutubeTitle(videoId)] as const),
    );
    for (const [videoId, title] of titles) {
      if (title !== null) result.set(videoId, title);
    }
  }

  return result;
}
