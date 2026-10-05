import { describe, expect, it } from "vitest";

import {
  LISTENING_PAGES,
  LISTENING_TRACKS,
  listeningPageHref,
  tracksForPage,
} from "@/features/listening/data";

describe("dữ liệu bài nghe Bài 3", () => {
  it("có đủ 22 file, đúng thứ tự trang và đường dẫn không trùng", () => {
    expect(LISTENING_TRACKS).toHaveLength(22);
    expect(new Set(LISTENING_TRACKS.map((track) => track.src)).size).toBe(22);
    expect(LISTENING_TRACKS.map((track) => track.page)).toEqual(
      [...LISTENING_TRACKS.map((track) => track.page)].sort((a, b) => a - b),
    );
    expect(
      LISTENING_TRACKS.every((track) =>
        track.src.startsWith("/audio/bai-3/trang-"),
      ),
    ).toBe(true);
  });

  it("gom đúng audio theo trang và tạo URL cố định", () => {
    expect(LISTENING_PAGES).toEqual([
      1, 2, 4, 6, 8, 9, 12, 13, 14, 15, 16, 17, 18,
    ]);
    expect(tracksForPage(12).map((track) => track.title)).toEqual([
      "Trang 12 – Các buổi trong ngày",
      "Trang 12 – Đơn vị ngày tháng",
    ]);
    expect(tracksForPage(3)).toEqual([]);
    expect(listeningPageHref(12)).toBe("/nghe/trang-12");
  });

  it("gắn đủ 22 ảnh vào đúng audio", () => {
    expect(LISTENING_TRACKS.every((track) => track.image)).toBe(true);
    expect(
      new Set(LISTENING_TRACKS.map((track) => track.image?.src)).size,
    ).toBe(22);
    expect(tracksForPage(1)[0]?.image?.src).toBe("/bai3/trang1.png");
    expect(tracksForPage(2).map((track) => track.image?.src)).toEqual([
      "/bai3/trang2-phan1.png",
      "/bai3/trang2-phan2.png",
    ]);
    expect(tracksForPage(15)[1]?.image?.src).toBe("/bai3/trang15-phan-iii.png");
    expect(tracksForPage(17)[1]?.image?.src).toBe("/bai3/trang17-tu-vung.png");
  });
});
