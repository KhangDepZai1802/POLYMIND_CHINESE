import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  PHAT_AM_TRACKS,
  PHAT_AM_AUDIO_PAGES,
  PHAT_AM_ALL_PAGES,
  PHAT_AM_SLIDES,
  phatAmPageHref,
  tracksForPhatAmPage,
} from "@/features/listening/phat-am-data";

describe("Bài phát âm supplied listening assets", () => {
  it("maps all eight provided recordings to their document pages", () => {
    expect(PHAT_AM_AUDIO_PAGES).toEqual([2, 3, 4, 9, 10, 11, 12, 13]);
    expect(PHAT_AM_TRACKS).toHaveLength(8);
    expect(new Set(PHAT_AM_TRACKS.map((track) => track.src)).size).toBe(8);
  });

  it("generates correct routes and page lookups", () => {
    expect(phatAmPageHref(2)).toBe("/nghe/phat-am/trang-2");
    expect(tracksForPhatAmPage(2)[0]?.src).toBe("/audio/phat-am/trang-02.mp3");
    expect(tracksForPhatAmPage(5)).toEqual([]);
  });

  it("ships readable illustrations and actual MP3 files for every entry", async () => {
    for (const track of PHAT_AM_TRACKS) {
      const audio = path.join(process.cwd(), "public", track.src);
      expect(statSync(audio).size).toBeGreaterThan(1000);
      expect(track.image).toBeDefined();
      const metadata = await sharp(
        path.join(process.cwd(), "public", track.image!.src),
      ).metadata();
      expect(metadata.width).toBe(track.image!.width);
      expect(metadata.height).toBe(track.image!.height);
    }
  });

  it("provides slides and WebP images for all 13 pages with exact dimensions", async () => {
    expect(PHAT_AM_ALL_PAGES).toHaveLength(13);
    for (const page of PHAT_AM_ALL_PAGES) {
      const slide = PHAT_AM_SLIDES[page];
      expect(slide).toBeDefined();
      if (!slide) continue;
      const metadata = await sharp(
        path.join(process.cwd(), "public", slide.image.src),
      ).metadata();
      expect(metadata.width).toBe(slide.image.width);
      expect(metadata.height).toBe(slide.image.height);
    }
  });
});
