import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  BAI4_TRACKS,
  BAI4_PAGES,
  bai4PageHref,
  tracksForBai4Page,
} from "@/features/listening/bai4-data";
import { tracksForPage } from "@/features/listening/data";
describe("Bài4 supplied listening assets", () => {
  it("maps all nine provided recordings to their document pages", () => {
    expect(BAI4_PAGES).toEqual([2, 4, 5, 6, 7, 25, 26, 29, 30]);
    expect(BAI4_TRACKS).toHaveLength(9);
    expect(new Set(BAI4_TRACKS.map((track) => track.src)).size).toBe(9);
  });
  it("keeps lesson4 routes and page lookups separate from lesson3", () => {
    expect(bai4PageHref(2)).toBe("/nghe/bai-4/trang-2");
    expect(tracksForBai4Page(2)[0]?.src).toBe("/audio/bai-4/trang-02.m4a");
    expect(
      tracksForPage(2).every((track) => track.src.startsWith("/audio/bai-3/")),
    ).toBe(true);
    expect(tracksForBai4Page(3)).toEqual([]);
  });
  it("ships readable illustrations and actual M4A files for every entry", async () => {
    for (const track of BAI4_TRACKS) {
      const audio = path.join(process.cwd(), "public", track.src);
      expect(statSync(audio).size).toBeGreaterThan(1000);
      expect(readFileSync(audio).subarray(4, 8).toString()).toBe("ftyp");
      expect(track.image).toBeDefined();
      const metadata = await sharp(
        path.join(process.cwd(), "public", track.image!.src),
      ).metadata();
      expect(metadata.width).toBe(track.image!.width);
      expect(metadata.height).toBe(track.image!.height);
    }
  });
});
