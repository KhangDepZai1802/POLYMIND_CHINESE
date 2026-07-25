import { describe, expect, it } from "vitest";

import {
  bulkMediaSlotOf,
  matchFlashcardMediaFiles,
  normalizePinyinKey,
  plannedUploads,
  summarizeBulkMedia,
  type BulkMediaFile,
  type BulkMediaTarget,
} from "@/features/flashcards/domain/bulk-media";

// Buổi mẫu dùng chung: trang mở đầu ở số 1, ba thẻ từ vựng ở số 2/3/4.
function target(
  overrides: Partial<BulkMediaTarget> & Pick<BulkMediaTarget, "pageId">,
): BulkMediaTarget {
  return {
    displayNumber: 2,
    kind: "vocabulary",
    hanzi: null,
    pinyinSyllables: null,
    hasFront: false,
    hasAudio: false,
    ...overrides,
  };
}

const COVER = target({
  pageId: "page-cover",
  displayNumber: 1,
  kind: "session_cover",
});
const CAROT = target({
  pageId: "page-carot",
  displayNumber: 2,
  hanzi: "胡萝卜",
  pinyinSyllables: "hú luó bo",
});
const APPLE = target({
  pageId: "page-apple",
  displayNumber: 3,
  hanzi: "苹果",
  pinyinSyllables: "píng guǒ",
});
const HELLO = target({
  pageId: "page-hello",
  displayNumber: 4,
  hanzi: "你好",
  pinyinSyllables: "nǐ hǎo",
});

const SECTION = [COVER, CAROT, APPLE, HELLO];

function audio(fileName: string, sizeBytes = 1024): BulkMediaFile {
  return { fileName, mimeType: "audio/mpeg", sizeBytes };
}
function image(fileName: string, sizeBytes = 1024): BulkMediaFile {
  return { fileName, mimeType: "image/jpeg", sizeBytes };
}

function plan(
  files: BulkMediaFile[],
  options?: {
    allowOverwrite?: boolean;
    overrides?: Map<string, string>;
    targets?: BulkMediaTarget[];
  },
) {
  return matchFlashcardMediaFiles(files, options?.targets ?? SECTION, {
    allowOverwrite: options?.allowOverwrite ?? false,
    overrides: options?.overrides,
  });
}

function rowOf(result: ReturnType<typeof plan>, pageId: string) {
  return result.rows.find((row) => row.target.pageId === pageId);
}

describe("chuẩn hoá khoá pinyin", () => {
  it("bỏ dấu thanh, dấu cách và phân biệt hoa thường", () => {
    expect(normalizePinyinKey("hú luó bo")).toBe("huluobo");
    expect(normalizePinyinKey("HU-LUO_BO")).toBe("huluobo");
    expect(normalizePinyinKey("píng guǒ")).toBe("pingguo");
  });

  it("ü và các biến thể có dấu của nó cùng về u", () => {
    expect(normalizePinyinKey("nǚ")).toBe("nu");
    expect(normalizePinyinKey("lǜ")).toBe("lu");
    expect(normalizePinyinKey("nü")).toBe("nu");
  });
});

describe("suy khe từ đuôi file", () => {
  it("ảnh về khe front, audio về khe audio", () => {
    expect(bulkMediaSlotOf(image("a.jpg"))).toBe("front");
    expect(
      bulkMediaSlotOf({
        fileName: "a.png",
        mimeType: "image/png",
        sizeBytes: 1,
      }),
    ).toBe("front");
    expect(
      bulkMediaSlotOf({
        fileName: "a.webp",
        mimeType: "image/webp",
        sizeBytes: 1,
      }),
    ).toBe("front");
    expect(bulkMediaSlotOf(audio("a.mp3"))).toBe("audio");
    expect(
      bulkMediaSlotOf({
        fileName: "a.m4a",
        mimeType: "audio/mp4",
        sizeBytes: 1,
      }),
    ).toBe("audio");
  });

  it("đuôi lạ, và đuôi không khớp MIME, đều bị loại", () => {
    expect(bulkMediaSlotOf(image("a.gif"))).toBeNull();
    expect(
      bulkMediaSlotOf({
        fileName: "a.mp3",
        mimeType: "image/jpeg",
        sizeBytes: 1,
      }),
    ).toBeNull();
  });
});

describe("ghép file với thẻ", () => {
  it("khớp theo Hán tự, kể cả khi tên file có tiền tố đánh số", () => {
    const result = plan([audio("胡萝卜.mp3"), image("01-苹果.jpg")]);

    expect(rowOf(result, "page-carot")?.audio).toEqual({
      state: "attach",
      fileName: "胡萝卜.mp3",
    });
    expect(rowOf(result, "page-apple")?.front).toEqual({
      state: "attach",
      fileName: "01-苹果.jpg",
    });
    expect(result.unmatched).toHaveLength(0);
  });

  it("khớp theo pinyin không dấu, chấp nhận gạch nối và gạch dưới", () => {
    const result = plan([
      audio("huluobo.mp3"),
      audio("ping-guo.mp3"),
      image("ni_hao.jpg"),
    ]);

    expect(rowOf(result, "page-carot")?.audio.state).toBe("attach");
    expect(rowOf(result, "page-apple")?.audio.state).toBe("attach");
    expect(rowOf(result, "page-hello")?.front.state).toBe("attach");
    expect(result.unmatched).toHaveLength(0);
  });

  it("khớp theo SỐ ĐANG HIỆN trên màn hình, không đánh số lại cho thẻ từ vựng", () => {
    // Thẻ từ vựng đầu tiên hiện số 2 (trang mở đầu chiếm số 1). Nếu ai đó "dồn
    // lại cho đẹp" thì `2.mp3` sẽ rơi vào 苹果 — lệch đúng một bậc trên cả buổi.
    const result = plan([audio("2.mp3"), audio("03.mp3")]);

    expect(rowOf(result, "page-carot")?.audio).toEqual({
      state: "attach",
      fileName: "2.mp3",
    });
    expect(rowOf(result, "page-apple")?.audio).toEqual({
      state: "attach",
      fileName: "03.mp3",
    });
  });

  it("số trỏ vào trang mở đầu bị từ chối bằng chữ, không lặng lẽ dồn sang thẻ khác", () => {
    const result = plan([audio("1.mp3")]);

    expect(result.unmatched).toEqual([
      {
        fileName: "1.mp3",
        reason: "cover-page",
        message: expect.stringContaining("trang mở đầu"),
      },
    ]);
    expect(plannedUploads(result)).toHaveLength(0);
  });

  it("số không ứng với trang nào thì báo không khớp, không rơi xuống ghép theo chữ", () => {
    const result = plan([audio("99.mp3")]);

    expect(result.unmatched[0]?.reason).toBe("no-match");
  });
});

describe("trùng khoá thì KHÔNG đoán", () => {
  it("hai thẻ cùng Hán tự (行 xíng / 行 háng) làm file rơi vào chưa khớp", () => {
    const xing = target({
      pageId: "page-xing",
      displayNumber: 2,
      hanzi: "行",
      pinyinSyllables: "xíng",
    });
    const hang = target({
      pageId: "page-hang",
      displayNumber: 3,
      hanzi: "行",
      pinyinSyllables: "háng",
    });

    const result = plan([audio("行.mp3")], { targets: [xing, hang] });

    expect(result.unmatched[0]).toMatchObject({
      fileName: "行.mp3",
      reason: "collision",
    });
    expect(plannedUploads(result)).toHaveLength(0);
  });

  it("hai thẻ cùng pinyin sau khi bỏ dấu (是 shì / 事 shì) cũng không bị gán bừa", () => {
    const shi1 = target({
      pageId: "page-shi-1",
      displayNumber: 2,
      hanzi: "是",
      pinyinSyllables: "shì",
    });
    const shi2 = target({
      pageId: "page-shi-2",
      displayNumber: 3,
      hanzi: "事",
      pinyinSyllables: "shì",
    });

    const result = plan([audio("shi.mp3")], { targets: [shi1, shi2] });

    expect(result.unmatched[0]?.reason).toBe("collision");
  });

  it("Hán tự khớp đúng thì thắng, không bị pinyin trùng kéo thành va chạm", () => {
    const shi1 = target({
      pageId: "page-shi-1",
      displayNumber: 2,
      hanzi: "是",
      pinyinSyllables: "shì",
    });
    const shi2 = target({
      pageId: "page-shi-2",
      displayNumber: 3,
      hanzi: "事",
      pinyinSyllables: "shì",
    });

    const result = plan([audio("是.mp3")], { targets: [shi1, shi2] });

    expect(result.unmatched).toHaveLength(0);
    expect(rowOf(result, "page-shi-1")?.audio.state).toBe("attach");
  });

  it("hai file tranh cùng một ô thì cả hai bị bỏ ra, không lấy file đến trước", () => {
    const result = plan([audio("胡萝卜.mp3"), audio("huluobo.mp3")]);

    expect(rowOf(result, "page-carot")?.audio).toEqual({
      state: "attach",
      fileName: "胡萝卜.mp3",
    });
    expect(result.unmatched).toEqual([
      {
        fileName: "huluobo.mp3",
        reason: "slot-taken",
        message: expect.stringContaining("胡萝卜.mp3"),
      },
    ]);
  });
});

describe("ghi đè", () => {
  const withAudio = [
    COVER,
    { ...CAROT, hasAudio: true },
    APPLE,
    HELLO,
  ] satisfies BulkMediaTarget[];

  it("mặc định TẮT: thẻ đã có audio bị bỏ qua, file cũ không mất", () => {
    const result = plan([audio("胡萝卜.mp3")], { targets: withAudio });

    expect(rowOf(result, "page-carot")?.audio).toEqual({
      state: "skip",
      fileName: "胡萝卜.mp3",
    });
    expect(plannedUploads(result)).toHaveLength(0);
    expect(summarizeBulkMedia(result).skippedCount).toBe(1);
  });

  it("bật lên: chuyển sang 'sẽ thay' và được đếm riêng khỏi 'sẽ thêm'", () => {
    const result = plan([audio("胡萝卜.mp3"), audio("苹果.mp3")], {
      targets: withAudio,
      allowOverwrite: true,
    });

    expect(rowOf(result, "page-carot")?.audio.state).toBe("replace");
    expect(rowOf(result, "page-apple")?.audio.state).toBe("attach");

    const summary = summarizeBulkMedia(result);
    expect(summary).toMatchObject({
      pageCount: 2,
      attachCount: 1,
      replaceCount: 1,
      skippedCount: 0,
    });
  });

  it("thẻ không có file nào khớp: đã có media thì 'keep', chưa có thì 'empty'", () => {
    const result = plan([], { targets: withAudio });

    expect(rowOf(result, "page-carot")?.audio).toEqual({ state: "keep" });
    expect(rowOf(result, "page-apple")?.audio).toEqual({ state: "empty" });
  });
});

describe("gán tay", () => {
  it("thắng phép ghép tự động dù file tự động đứng trước trong danh sách", () => {
    const result = plan([audio("胡萝卜.mp3"), audio("ghi-am-la.mp3")], {
      overrides: new Map([["ghi-am-la.mp3", "page-carot"]]),
    });

    expect(rowOf(result, "page-carot")?.audio).toEqual({
      state: "attach",
      fileName: "ghi-am-la.mp3",
    });
    expect(result.unmatched).toEqual([
      {
        fileName: "胡萝卜.mp3",
        reason: "slot-taken",
        message: expect.stringContaining("ghi-am-la.mp3"),
      },
    ]);
  });

  it("cứu được file va chạm khoá", () => {
    const xing = target({
      pageId: "page-xing",
      displayNumber: 2,
      hanzi: "行",
      pinyinSyllables: "xíng",
    });
    const hang = target({
      pageId: "page-hang",
      displayNumber: 3,
      hanzi: "行",
      pinyinSyllables: "háng",
    });

    const result = plan([audio("行.mp3")], {
      targets: [xing, hang],
      overrides: new Map([["行.mp3", "page-hang"]]),
    });

    expect(result.unmatched).toHaveLength(0);
    expect(rowOf(result, "page-hang")?.audio.state).toBe("attach");
  });

  it("gán tay vào trang mở đầu không được chấp nhận", () => {
    const result = plan([audio("bat-ky.mp3")], {
      overrides: new Map([["bat-ky.mp3", "page-cover"]]),
    });

    expect(result.rows.some((row) => row.target.kind === "session_cover")).toBe(
      false,
    );
    expect(result.unmatched[0]?.fileName).toBe("bat-ky.mp3");
  });
});

describe("loại file trước khi tải", () => {
  it("sai định dạng bị loại kèm câu tiếng Việt", () => {
    const result = plan([image("胡萝卜.gif")]);

    expect(result.unmatched[0]).toMatchObject({ reason: "bad-format" });
    expect(result.unmatched[0]?.message).toContain("JPG");
  });

  it("ảnh quá 8 MB và audio quá 20 MB đều bị loại theo đúng trần của khe", () => {
    const result = plan([
      image("胡萝卜.jpg", 9 * 1024 * 1024),
      audio("苹果.mp3", 21 * 1024 * 1024),
    ]);

    expect(result.unmatched).toHaveLength(2);
    expect(result.unmatched.every((item) => item.reason === "too-large")).toBe(
      true,
    );
  });

  it("ảnh 9 MB bị loại nhưng audio 9 MB thì không — trần theo khe, không dùng chung", () => {
    const result = plan([
      image("胡萝卜.jpg", 9 * 1024 * 1024),
      audio("苹果.mp3", 9 * 1024 * 1024),
    ]);

    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]?.fileName).toBe("胡萝卜.jpg");
    expect(rowOf(result, "page-apple")?.audio.state).toBe("attach");
  });
});

describe("bảng kê gửi lên server", () => {
  it("chỉ gồm khe sẽ thêm hoặc sẽ thay, kèm đúng pageId và khe", () => {
    const result = plan([audio("胡萝卜.mp3"), image("胡萝卜.jpg")]);

    expect(plannedUploads(result)).toEqual(
      expect.arrayContaining([
        { pageId: "page-carot", slot: "front", fileName: "胡萝卜.jpg" },
        { pageId: "page-carot", slot: "audio", fileName: "胡萝卜.mp3" },
      ]),
    );
    expect(plannedUploads(result)).toHaveLength(2);
    // Một thẻ nhận hai khe vẫn chỉ là MỘT thẻ — con số in trên nút xác nhận.
    expect(summarizeBulkMedia(result).pageCount).toBe(1);
  });

  it("buổi không có file nào thì không gửi gì", () => {
    expect(plannedUploads(plan([]))).toEqual([]);
  });
});
