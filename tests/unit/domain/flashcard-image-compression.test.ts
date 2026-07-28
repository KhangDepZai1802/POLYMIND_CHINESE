import { describe, expect, it } from "vitest";

import {
  compressedFileName,
  fitWithinMaxEdge,
  FLASHCARD_IMAGE_MAX_EDGE,
  imageExtensionFromMime,
  needsCompression,
  shouldUseCompressed,
} from "@/features/flashcards/domain/image-compression";

describe("fitWithinMaxEdge", () => {
  it("thu cạnh dài về đúng ngưỡng và giữ tỉ lệ", () => {
    expect(fitWithinMaxEdge({ width: 4000, height: 3000 })).toEqual({
      width: 1280,
      height: 960,
    });
    expect(fitWithinMaxEdge({ width: 3000, height: 4000 })).toEqual({
      width: 960,
      height: 1280,
    });
  });

  it("KHÔNG phóng to ảnh vốn đã nhỏ", () => {
    expect(fitWithinMaxEdge({ width: 640, height: 480 })).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("ảnh đúng bằng ngưỡng thì giữ nguyên", () => {
    const size = { width: FLASHCARD_IMAGE_MAX_EDGE, height: 700 };
    expect(fitWithinMaxEdge(size)).toEqual(size);
  });

  it("ảnh cực dẹt không bao giờ ra cạnh 0", () => {
    // Cạnh ngắn tính ra 0.96px. Làm tròn xuống 0 là canvas 0px và `toBlob` trả
    // `null` — cả lượt nén rơi về file gốc mà không ai biết vì sao.
    const fitted = fitWithinMaxEdge({ width: 4000, height: 3 });
    expect(fitted.width).toBe(1280);
    expect(fitted.height).toBeGreaterThanOrEqual(1);
  });
});

describe("needsCompression", () => {
  it("ảnh vừa khung và nhẹ sẵn thì bỏ qua", () => {
    expect(
      needsCompression({ bytes: 80 * 1024, size: { width: 800, height: 600 } }),
    ).toBe(false);
  });

  it("quá cạnh dài thì nén, dù file nhẹ", () => {
    expect(
      needsCompression({ bytes: 30 * 1024, size: { width: 3000, height: 100 } }),
    ).toBe(true);
  });

  it("vừa khung nhưng nặng thì vẫn nén", () => {
    expect(
      needsCompression({ bytes: 4 * 1024 * 1024, size: { width: 1200, height: 900 } }),
    ).toBe(true);
  });
});

describe("imageExtensionFromMime", () => {
  it("đọc đúng ba định dạng ảnh được phép", () => {
    expect(imageExtensionFromMime("image/jpeg")).toBe("jpg");
    expect(imageExtensionFromMime("image/png")).toBe("png");
    expect(imageExtensionFromMime("image/webp")).toBe("webp");
  });

  it("bỏ tham số phía sau và không phân biệt hoa thường", () => {
    expect(imageExtensionFromMime("IMAGE/WEBP; charset=binary")).toBe("webp");
  });

  it("kiểu lạ / rỗng → null", () => {
    // Đây là chốt chặn cho cái bẫy `toBlob`: xin WebP ở trình duyệt không hỗ trợ
    // thì nó lặng lẽ trả PNG. Tin lời mình xin thay vì đọc `blob.type` là file
    // PNG mang tên `.webp`, và bước soi ở server vứt cả lượt tải.
    expect(imageExtensionFromMime("image/gif")).toBeNull();
    expect(imageExtensionFromMime("")).toBeNull();
    expect(imageExtensionFromMime(null)).toBeNull();
  });
});

describe("compressedFileName", () => {
  it("chỉ đổi đuôi, giữ nguyên phần gốc", () => {
    expect(compressedFileName("01-胡萝卜.JPG", "webp")).toBe("01-胡萝卜.webp");
    expect(compressedFileName("bai.12.anh.png", "webp")).toBe("bai.12.anh.webp");
  });

  it("tên không có đuôi thì gắn thêm", () => {
    expect(compressedFileName("anh", "jpg")).toBe("anh.jpg");
  });

  it("giữ nguyên phần gốc — đó là khoá ghép file với thẻ", () => {
    // `matchFlashcardMediaFiles` ghép theo số thứ tự / Hán tự / pinyin đọc từ
    // phần gốc. Đụng vào đó là ảnh rơi sang nhầm thẻ.
    expect(compressedFileName("3. huluobo.jpeg", "webp")).toBe("3. huluobo.webp");
  });
});

describe("shouldUseCompressed", () => {
  it("nhỏ hơn thì dùng bản nén", () => {
    expect(shouldUseCompressed({ originalBytes: 2_000_000, compressedBytes: 180_000 })).toBe(true);
  });

  it("phình ra thì giữ bản gốc", () => {
    expect(shouldUseCompressed({ originalBytes: 12_000, compressedBytes: 30_000 })).toBe(false);
  });

  it("bằng nhau cũng giữ bản gốc — không đánh đổi chất lượng lấy 0 byte", () => {
    expect(shouldUseCompressed({ originalBytes: 50_000, compressedBytes: 50_000 })).toBe(false);
  });

  it("blob rỗng không bao giờ được dùng", () => {
    expect(shouldUseCompressed({ originalBytes: 50_000, compressedBytes: 0 })).toBe(false);
  });
});
