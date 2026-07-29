import { describe, expect, it } from "vitest";

import {
  matchFlashcardCoverFiles,
  plannedCoverUploads,
  readSessionNumberFromFileName,
  summarizeCoverPlan,
  type CoverFile,
  type CoverTarget,
} from "@/features/flashcards/domain/deck-covers";

/**
 * Ghép ẢNH TRANG MỞ ĐẦU với BUỔI (`COVER-1`/`D-41`).
 *
 * Thứ đắt nhất mà bộ ghép này phải tránh là **lệch im lặng**: ảnh bìa của buổi 5
 * rơi vào buổi 6 thì không có gì trên màn hình nói rằng nó sai — chỉ tới khi
 * sách đã in và học sinh quét mã mới lộ. Vì vậy phần lớn bài dưới đây kiểm cái
 * mà bộ ghép **từ chối làm**, chứ không phải cái nó làm được.
 */

function target(overrides: Partial<CoverTarget> & { sessionNumber: number }) {
  return {
    sectionId: `s-${overrides.sessionNumber}`,
    title: `Buổi ${overrides.sessionNumber}`,
    published: false,
    hasCover: false,
    ...overrides,
  } satisfies CoverTarget;
}

function image(fileName: string, sizeBytes = 1024): CoverFile {
  return { fileName, mimeType: "image/png", sizeBytes };
}

const TARGETS = [
  target({ sessionNumber: 1 }),
  target({ sessionNumber: 2 }),
  target({ sessionNumber: 12 }),
];

describe("readSessionNumberFromFileName", () => {
  it.each([
    ["01.png", 1],
    ["1.jpg", 1],
    ["buoi-01.webp", 1],
    ["bia-buoi-12.jpg", 12],
    ["Buổi 2.png", 2],
  ])("%s → buổi %i", (fileName, expected) => {
    const read = readSessionNumberFromFileName(fileName);
    expect(read.kind).toBe("ok");
    if (read.kind !== "ok") return;
    expect(read.sessionNumber).toBe(expected);
  });

  it("số 0 ở đầu không tạo ra một buổi khác", () => {
    expect(readSessionNumberFromFileName("007.png")).toEqual(
      readSessionNumberFromFileName("7.png"),
    );
  });

  it("tên không có số thì TỪ CHỐI, không đoán", () => {
    expect(readSessionNumberFromFileName("bia-ngan-hang.png").kind).toBe("none");
  });

  it("🔴 tên có NHIỀU dãy số thì từ chối — đây là bài quan trọng nhất của file", () => {
    // Lấy "dãy đầu tiên" sẽ biến `2026-01-05-bia.png` thành buổi 2026 (miss, còn
    // thấy được) nhưng `05-2026-bia.png` thành buổi 5 một cách rất thuyết phục
    // và SAI. Từ chối rồi để người soạn gán tay là đường duy nhất không sinh ra
    // lỗi im lặng.
    const read = readSessionNumberFromFileName("05-2026-bia.png");
    expect(read.kind).toBe("ambiguous");
    if (read.kind !== "ambiguous") return;
    expect(read.found).toEqual([5, 2026]);
  });
});

describe("matchFlashcardCoverFiles", () => {
  it("ghép theo số buổi và đánh dấu buổi trống là 'sẽ thêm'", () => {
    const plan = matchFlashcardCoverFiles(
      [image("01.png"), image("bia-buoi-12.png")],
      TARGETS,
      { allowOverwrite: false },
    );

    expect(plan.unmatched).toEqual([]);
    expect(plan.rows.map((row) => row.plan.state)).toEqual([
      "attach",
      "empty",
      "attach",
    ]);
    expect(plannedCoverUploads(plan)).toEqual([
      { sectionId: "s-1", fileName: "01.png" },
      { sectionId: "s-12", fileName: "bia-buoi-12.png" },
    ]);
  });

  it("buổi đã có bìa: ghi đè TẮT thì bỏ qua, BẬT thì thay", () => {
    const targets = [target({ sessionNumber: 1, hasCover: true })];

    const off = matchFlashcardCoverFiles([image("01.png")], targets, {
      allowOverwrite: false,
    });
    expect(off.rows[0]?.plan.state).toBe("skip");
    expect(plannedCoverUploads(off)).toEqual([]);

    const on = matchFlashcardCoverFiles([image("01.png")], targets, {
      allowOverwrite: true,
    });
    expect(on.rows[0]?.plan.state).toBe("replace");
    expect(plannedCoverUploads(on)).toHaveLength(1);
  });

  it("🔴 buổi ĐÃ CÔNG BỐ không bao giờ được gắn, kể cả khi bật Ghi đè", () => {
    // `D-41` điểm 4. Nếu bài này chuyển sang xanh với `state = "replace"` thì
    // giao diện đang hứa một việc mà DB sẽ từ chối — và người soạn chỉ biết sau
    // khi đã ngồi chờ nén + tải xong 35 ảnh.
    const targets = [
      target({ sessionNumber: 1, published: true, hasCover: true }),
    ];
    const plan = matchFlashcardCoverFiles([image("01.png")], targets, {
      allowOverwrite: true,
    });

    expect(plan.rows[0]?.plan.state).toBe("published");
    expect(plannedCoverUploads(plan)).toEqual([]);
    expect(summarizeCoverPlan(plan).publishedCount).toBe(1);
  });

  it("buổi đã công bố mà KHÔNG có ảnh nào rơi vào thì không tính là cảnh báo", () => {
    // Ngược lại với bài trên: đếm mọi buổi đã công bố sẽ hiện "35 ảnh bị chặn"
    // ngay cả khi người soạn chỉ thả đúng 2 ảnh cho 2 buổi nháp.
    const targets = [target({ sessionNumber: 1, published: true })];
    const plan = matchFlashcardCoverFiles([], targets, {
      allowOverwrite: false,
    });
    expect(summarizeCoverPlan(plan).publishedCount).toBe(0);
  });

  it("hai ảnh tranh cùng một buổi: bỏ ảnh sau ra, KHÔNG chọn bừa", () => {
    // Thứ tự file do hệ điều hành quyết định, nên "lấy file đến trước" sẽ cho
    // kết quả khác nhau giữa hai lần thả cùng một bộ file.
    const plan = matchFlashcardCoverFiles(
      [image("01.png"), image("buoi-1.png")],
      TARGETS,
      { allowOverwrite: false },
    );

    expect(plan.rows[0]?.plan).toEqual({ state: "attach", fileName: "01.png" });
    expect(plan.unmatched).toEqual([
      {
        fileName: "buoi-1.png",
        reason: "slot-taken",
        message: expect.stringContaining("01.png"),
      },
    ]);
  });

  it("số buổi không có trong bộ thì nói rõ, không im lặng bỏ", () => {
    const plan = matchFlashcardCoverFiles([image("99.png")], TARGETS, {
      allowOverwrite: false,
    });
    expect(plan.unmatched[0]?.reason).toBe("no-match");
    expect(plan.unmatched[0]?.message).toContain("buổi 99");
  });

  it("gán tay THẮNG phép ghép tự động", () => {
    // Người soạn nhìn thấy nội dung ảnh, thuật toán chỉ nhìn thấy tên file.
    const plan = matchFlashcardCoverFiles([image("01.png")], TARGETS, {
      allowOverwrite: false,
      overrides: new Map([["01.png", "s-2"]]),
    });

    expect(plan.rows[0]?.plan.state).toBe("empty");
    expect(plan.rows[1]?.plan).toEqual({ state: "attach", fileName: "01.png" });
  });

  it("gán tay được xử TRƯỚC nên không bị file tự động chiếm mất chỗ", () => {
    const plan = matchFlashcardCoverFiles(
      // `02.png` đứng trước trong danh sách và tự động khớp buổi 2; `bia.png`
      // được gán tay vào đúng buổi đó. Lựa chọn tay phải thắng.
      [image("02.png"), image("bia.png")],
      TARGETS,
      { allowOverwrite: false, overrides: new Map([["bia.png", "s-2"]]) },
    );

    expect(plan.rows[1]?.plan).toEqual({ state: "attach", fileName: "bia.png" });
    expect(plan.unmatched.map((item) => item.fileName)).toEqual(["02.png"]);
  });

  it("chỉ nhận ảnh — audio bị loại bằng chữ, không âm thầm", () => {
    const plan = matchFlashcardCoverFiles(
      [{ fileName: "01.mp3", mimeType: "audio/mpeg", sizeBytes: 1024 }],
      TARGETS,
      { allowOverwrite: false },
    );
    expect(plan.unmatched[0]?.reason).toBe("bad-format");
  });

  it("ảnh quá 8 MB bị loại trước khi tốn một byte đường truyền", () => {
    const plan = matchFlashcardCoverFiles(
      [image("01.png", 9 * 1024 * 1024)],
      TARGETS,
      { allowOverwrite: false },
    );
    expect(plan.unmatched[0]?.reason).toBe("too-large");
  });

  it("bảng luôn có đủ MỘT hàng cho mỗi buổi, kể cả buổi không nhận ảnh", () => {
    // Bảng đối chiếu là thứ người soạn đọc để biết buổi nào bị bỏ sót; lọc bớt
    // hàng "không có gì xảy ra" chính là giấu đi thông tin đó.
    const plan = matchFlashcardCoverFiles([image("01.png")], TARGETS, {
      allowOverwrite: false,
    });
    expect(plan.rows).toHaveLength(TARGETS.length);
  });

  it("summarize đếm đúng số BUỔI sẽ đổi, không phải số file", () => {
    const targets = [
      target({ sessionNumber: 1 }),
      target({ sessionNumber: 2, hasCover: true }),
      target({ sessionNumber: 12, published: true }),
    ];
    const plan = matchFlashcardCoverFiles(
      [image("01.png"), image("02.png"), image("12.png"), image("x.png")],
      targets,
      { allowOverwrite: true },
    );

    expect(summarizeCoverPlan(plan)).toEqual({
      sessionCount: 2,
      attachCount: 1,
      replaceCount: 1,
      skippedCount: 0,
      publishedCount: 1,
      unmatchedCount: 1,
    });
  });
});
