"use client";

import {
  compressedFileName,
  fitWithinMaxEdge,
  FLASHCARD_IMAGE_QUALITY,
  imageExtensionFromMime,
  needsCompression,
  shouldUseCompressed,
} from "@/features/flashcards/domain/image-compression";

/**
 * NÉN ẢNH NGAY TRÊN MÁY ADMIN, TRƯỚC KHI TẢI LÊN (`PERF-IMG-1`).
 *
 * Phần chạm trình duyệt của `domain/image-compression.ts` — mọi quyết định
 * (kích thước đích, đuôi file, có dùng bản nén hay không) đều hỏi bên đó, ở đây
 * chỉ có giải mã → vẽ → mã hoá.
 *
 * 🔴 **FAIL-OPEN, CÓ CHỦ Ý.** Mọi trục trặc — trình duyệt không giải mã được
 * file, hết bộ nhớ, `toBlob` trả `null` — đều trả về **file gốc** chứ không ném
 * lỗi. Nén là việc tăng tốc cho học viên; để nó chặn được đường đăng bài của
 * admin là đổi một vấn đề hiệu năng lấy một vấn đề nghiệp vụ. Xấu nhất thì đúng
 * bằng hành vi trước đợt này.
 *
 * ⚠️ Chạy TUẦN TỰ khi gọi theo lô: giải mã một tấm 4000px ngốn vài chục MB, mở
 * 60 tấm cùng lúc là tab chết ngay trên laptop 8GB của phòng đào tạo.
 */

export type CompressedImage = {
  /** File để tải lên — bản nén, hoặc chính file gốc nếu nén không có lợi. */
  file: File;
  originalBytes: number;
  bytes: number;
  /** `true` khi trả về nguyên file gốc (đã nhẹ sẵn, hoặc nén không ăn thua). */
  keptOriginal: boolean;
};

function isCompressibleImage(file: File): boolean {
  return imageExtensionFromMime(file.type) !== null;
}

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    // `from-image`: ảnh chụp bằng điện thoại mang cờ xoay trong EXIF. Vẽ lên
    // canvas mà bỏ qua cờ đó là ảnh **nằm ngang** trên thẻ của học viên — lỗi
    // nhìn thấy được, do chính bước "tối ưu" gây ra.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

function encode(
  canvas: HTMLCanvasElement,
  mimeType: string,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, FLASHCARD_IMAGE_QUALITY);
  });
}

export async function compressFlashcardImage(
  file: File,
): Promise<CompressedImage> {
  const original: CompressedImage = {
    file,
    originalBytes: file.size,
    bytes: file.size,
    keptOriginal: true,
  };

  // Audio và mọi thứ không phải ảnh đi thẳng, không đụng tới.
  if (typeof window === "undefined" || !isCompressibleImage(file)) {
    return original;
  }

  const bitmap = await decode(file);
  if (!bitmap) return original;

  try {
    const size = { width: bitmap.width, height: bitmap.height };
    if (!needsCompression({ bytes: file.size, size })) return original;

    const target = fitWithinMaxEdge(size);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    /*
     * WebP trước: nhẹ hơn JPEG ~25–30% ở cùng chất lượng, và **giữ được nền
     * trong suốt** nên ảnh PNG tách nền không bị đổ đen.
     *
     * Nếu trình duyệt không hỗ trợ, `toBlob` lặng lẽ trả PNG (xem
     * `imageExtensionFromMime`). Lúc đó thử lại bằng JPEG — nhưng CHỈ khi ảnh
     * gốc vốn đã là JPEG, tức chắc chắn không có kênh trong suốt để mà mất.
     */
    let blob = await encode(canvas, "image/webp");
    let extension = imageExtensionFromMime(blob?.type);
    if (extension !== "webp" && imageExtensionFromMime(file.type) === "jpg") {
      const retry = await encode(canvas, "image/jpeg");
      const retryExtension = imageExtensionFromMime(retry?.type);
      if (retry && retryExtension) {
        blob = retry;
        extension = retryExtension;
      }
    }

    // Giải phóng ngay: Safari trên iPad giữ canvas rất lâu, và một lượt 60 ảnh
    // thì đó là hàng trăm MB không ai đòi lại.
    canvas.width = 0;
    canvas.height = 0;

    if (!blob || !extension) return original;
    if (
      !shouldUseCompressed({
        originalBytes: file.size,
        compressedBytes: blob.size,
      })
    ) {
      return original;
    }

    return {
      file: new File([blob], compressedFileName(file.name, extension), {
        type: blob.type,
        lastModified: file.lastModified,
      }),
      originalBytes: file.size,
      bytes: blob.size,
      keptOriginal: false,
    };
  } catch {
    return original;
  } finally {
    bitmap.close();
  }
}

/**
 * Nén cả lô, tuần tự, có báo tiến độ.
 *
 * Trả `Map<tên file GỐC, kết quả>` — khoá là tên gốc vì bảng đối chiếu của tab
 * "Gắn media hàng loạt" đã ghép file với thẻ **theo tên gốc** từ trước đó. Đổi
 * khoá sang tên mới là mọi ảnh rơi sang nhầm thẻ.
 */
export async function compressFlashcardImages(
  files: readonly File[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, CompressedImage>> {
  const result = new Map<string, CompressedImage>();
  let done = 0;
  for (const file of files) {
    result.set(file.name, await compressFlashcardImage(file));
    done += 1;
    onProgress?.(done, files.length);
  }
  return result;
}
