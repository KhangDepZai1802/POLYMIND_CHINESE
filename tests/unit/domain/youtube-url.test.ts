import { describe, expect, it } from "vitest";

import {
  describeVideoImportIssue,
  MAX_VIDEO_IMPORT_ROWS,
  parseVideoImportText,
  parseYoutubeId,
  stripSessionPrefix,
  youtubeWatchUrl,
} from "@/features/videos/domain/youtube-url";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeId — 8 dạng URL người dùng thật sự dán", () => {
  it("youtu.be/<ID> — nút Chia sẻ", () => {
    expect(parseYoutubeId(`https://youtu.be/${ID}`)).toBe(ID);
  });

  it("watch?v=<ID> — copy từ thanh địa chỉ", () => {
    expect(parseYoutubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("m.youtube.com kèm mốc thời gian &t=", () => {
    expect(parseYoutubeId(`https://m.youtube.com/watch?v=${ID}&t=90s`)).toBe(ID);
  });

  it("/embed/<ID>", () => {
    expect(parseYoutubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });

  it("/shorts/<ID>", () => {
    expect(parseYoutubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it("youtu.be/<ID>?si=… — dạng Chia sẻ mới của YouTube", () => {
    expect(parseYoutubeId(`https://youtu.be/${ID}?si=AbCdEfGhIjKl`)).toBe(ID);
  });

  it("ID trần, không có link", () => {
    expect(parseYoutubeId(ID)).toBe(ID);
  });

  it("link KHÔNG phải YouTube → null", () => {
    expect(parseYoutubeId("https://facebook.com/watch?v=123456789012")).toBeNull();
  });

  it("thiếu scheme vẫn đọc được — người dùng hay dán cụt", () => {
    expect(parseYoutubeId(`youtu.be/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("ID sai độ dài → null, KHÔNG vớt vát", () => {
    expect(parseYoutubeId("https://youtu.be/short")).toBeNull();
    expect(parseYoutubeId("https://youtu.be/waytoolongvideoid")).toBeNull();
    expect(parseYoutubeId("abc")).toBeNull();
  });

  it("chuỗi rỗng / rác → null", () => {
    expect(parseYoutubeId("")).toBeNull();
    expect(parseYoutubeId("   ")).toBeNull();
    expect(parseYoutubeId("buoi4 chưa quay")).toBeNull();
  });

  it("dựng lại link xem từ ID", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
});

describe("stripSessionPrefix — chống lặp 'Buổi 1 · Buổi 1.'", () => {
  it("cắt đúng dạng user đặt trên YouTube", () => {
    expect(
      stripSessionPrefix("Buổi 1. Chào hỏi và mở đầu đàm phán", 1),
    ).toBe("Chào hỏi và mở đầu đàm phán");
  });

  it("nhận nhiều kiểu dấu ngăn và số 0 đứng đầu", () => {
    expect(stripSessionPrefix("Buổi 07 - Giới thiệu công ty", 7)).toBe(
      "Giới thiệu công ty",
    );
    expect(stripSessionPrefix("BUỔI 3: Đàm phán lãi suất", 3)).toBe(
      "Đàm phán lãi suất",
    );
    expect(stripSessionPrefix("Bài 2) Chốt hợp đồng", 2)).toBe("Chốt hợp đồng");
    expect(stripSessionPrefix("buoi 5 Thanh toán quốc tế", 5)).toBe(
      "Thanh toán quốc tế",
    );
  });

  it("KHÔNG cắt khi số không khớp — để lộ ra chỗ đặt nhầm link", () => {
    expect(stripSessionPrefix("Buổi 10. Chào hỏi", 1)).toBe("Buổi 10. Chào hỏi");
  });

  it("cắt xong mà rỗng thì giữ nguyên bản gốc", () => {
    expect(stripSessionPrefix("Buổi 5", 5)).toBe("Buổi 5");
    expect(stripSessionPrefix("Buổi 5.", 5)).toBe("Buổi 5.");
  });

  it("tiêu đề không có tiền tố thì giữ nguyên", () => {
    expect(stripSessionPrefix("Chào hỏi và mở đầu đàm phán", 1)).toBe(
      "Chào hỏi và mở đầu đàm phán",
    );
  });

  it("đọc được cả chuỗi ở dạng tổ hợp (NFD)", () => {
    const nfd = "Buổi 1. Chào hỏi".normalize("NFD");
    expect(stripSessionPrefix(nfd, 1)).toBe("Chào hỏi".normalize("NFC"));
  });
});

describe("parseVideoImportText", () => {
  const opts = { maxSessionNumber: 35 };

  it("đọc dạng có dấu | kèm tiêu đề tuỳ chọn", () => {
    const result = parseVideoImportText(
      [
        `1 | https://youtu.be/${ID} | Chào hỏi`,
        `2 | https://www.youtube.com/watch?v=abc12345678`,
      ].join("\n"),
      opts,
    );

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]).toMatchObject({
      sessionNumber: 1,
      youtubeVideoId: ID,
      title: "Chào hỏi",
    });
    // Bỏ trống tiêu đề → null, để caller đi lấy từ YouTube.
    expect(result.valid[1]!.title).toBeNull();
  });

  it("đọc được cả khi thiếu dấu | (dán từ Excel, gõ nhanh)", () => {
    const result = parseVideoImportText(`3 https://youtu.be/${ID} Đàm phán`, opts);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ sessionNumber: 3, title: "Đàm phán" });
  });

  it("đọc số buổi có chữ 'buổi' và số 0 đứng đầu", () => {
    const result = parseVideoImportText(
      [`buổi 7 | https://youtu.be/${ID}`, `Buoi 08 | https://youtu.be/abc12345678`].join(
        "\n",
      ),
      opts,
    );
    expect(result.valid.map((row) => row.sessionNumber)).toEqual([7, 8]);
  });

  it("🔴 trùng số buổi → CẢ HAI dòng hỏng, không chọn bừa dòng nào", () => {
    const result = parseVideoImportText(
      [`1 | https://youtu.be/${ID}`, `01 | https://youtu.be/abc12345678`].join("\n"),
      opts,
    );

    expect(result.valid).toHaveLength(0);
    expect(result.rows.map((row) => row.issue)).toEqual([
      "duplicate-session",
      "duplicate-session",
    ]);
  });

  it("số buổi vượt phạm vi khoá", () => {
    const result = parseVideoImportText(`40 | https://youtu.be/${ID}`, opts);
    expect(result.rows[0]!.issue).toBe("out-of-range");
    expect(result.valid).toHaveLength(0);
  });

  it("không đọc được link → báo lỗi, không im lặng bỏ qua", () => {
    const result = parseVideoImportText("4 | buoi4 chưa quay", opts);
    expect(result.rows[0]!.issue).toBe("no-link");
  });

  it("không đọc được số buổi", () => {
    const result = parseVideoImportText(`abc | https://youtu.be/${ID}`, opts);
    expect(result.rows[0]!.issue).toBe("bad-session");
  });

  it("bỏ qua dòng trống và giữ đúng SỐ DÒNG người dùng thấy", () => {
    const result = parseVideoImportText(
      ["", `1 | https://youtu.be/${ID}`, "", "", "5 | hỏng"].join("\n"),
      opts,
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.lineNumber).toBe(2);
    expect(result.rows[1]!.lineNumber).toBe(5);
  });

  it("cùng một video gán cho 2 buổi → CẢNH BÁO, không chặn (có thể cố ý)", () => {
    const result = parseVideoImportText(
      [`1 | https://youtu.be/${ID}`, `2 | https://youtu.be/${ID}`].join("\n"),
      opts,
    );
    expect(result.valid).toHaveLength(2);
    expect(result.duplicateVideoIds).toEqual([ID]);
  });

  it(`quá ${MAX_VIDEO_IMPORT_ROWS} dòng thì các dòng thừa bị đánh dấu`, () => {
    const lines = Array.from(
      { length: MAX_VIDEO_IMPORT_ROWS + 2 },
      (_, index) => `${index + 1} | https://youtu.be/${ID}`,
    );
    const result = parseVideoImportText(lines.join("\n"), {
      maxSessionNumber: MAX_VIDEO_IMPORT_ROWS + 5,
    });
    expect(result.rows.at(-1)!.issue).toBe("too-many-rows");
  });

  it("mọi ca hỏng đều có câu giải thích bằng chữ", () => {
    const issues = [
      "no-link",
      "bad-session",
      "out-of-range",
      "duplicate-session",
      "too-many-rows",
    ] as const;
    for (const issue of issues) {
      const message = describeVideoImportIssue(issue, { maxSessionNumber: 35 });
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
