import type { ListeningTrack } from "./data";

export const PHAT_AM_TITLE = "Bài phát âm – 汉语拼音";
export const PHAT_AM_BOOK_PAGE_COUNT = 13;

export const PHAT_AM_SLIDES: Record<
  number,
  {
    title: string;
    image: { src: string; width: number; height: number };
    description?: string;
  }
> = {
  1: {
    title: "Trang 1 – Bìa: Bài phát âm (汉语拼音)",
    image: { src: "/phat-am/trang-1.webp", width: 1491, height: 1000 },
    description: "Giới thiệu tổng quan hệ thống phiên âm Hán ngữ (Pinyin).",
  },
  2: {
    title: "Trang 2 – Cấu trúc âm tiết: Thanh mẫu, Vận mẫu & Thanh điệu",
    image: { src: "/phat-am/trang-2.webp", width: 1491, height: 900 },
    description:
      "Cấu tạo âm tiết trong tiếng Trung gồm Thanh mẫu (phụ âm đầu), Vận mẫu (nguyên âm) và Thanh điệu.",
  },
  3: {
    title: "Trang 3 – Bốn thanh điệu cơ bản",
    image: { src: "/phat-am/trang-3.webp", width: 1491, height: 930 },
    description:
      "Độ cao và hướng đi của 4 thanh điệu: Thanh 1 (55), Thanh 2 (35), Thanh 3 (214), Thanh 4 (51).",
  },
  4: {
    title: "Trang 4 – Thanh nhẹ (Khinh thanh) & Luyện đọc",
    image: { src: "/phat-am/trang-4.webp", width: 1491, height: 885 },
    description:
      "Cách đọc âm ngắn, nhẹ khi đứng sau các thanh điệu khác nhau và bài tập luyện thanh điệu.",
  },
  5: {
    title: "Trang 5 – Biến điệu của thanh 3",
    image: { src: "/phat-am/trang-5.webp", width: 1492, height: 899 },
    description:
      "Quy tắc biến âm khi hai hoặc nhiều âm mang thanh 3 đi liền nhau (ví dụ: Nǐ hǎo -> Ní hǎo).",
  },
  6: {
    title: 'Trang 6 – Biến điệu của "一" (Yī)',
    image: { src: "/phat-am/trang-6.webp", width: 1491, height: 905 },
    description:
      'Quy tắc đổi thanh của từ "一": đọc yí trước thanh 4, đọc yì trước thanh 1, 2, 3.',
  },
  7: {
    title: 'Trang 7 – Biến điệu của "不" (Bù)',
    image: { src: "/phat-am/trang-7.webp", width: 1491, height: 905 },
    description:
      'Quy tắc đổi thanh của từ "不": đọc bú trước thanh 4 (ví dụ: bú shì, bú qù).',
  },
  8: {
    title: "Trang 8 – Quy tắc viết phiên âm Pinyin",
    image: { src: "/phat-am/trang-8.webp", width: 1492, height: 904 },
    description:
      "Quy tắc viết j, q, x với ü (bỏ hai chấm), quy tắc cách viết u và i khi đứng đầu âm tiết.",
  },
  9: {
    title: "Trang 9 – Bảng ghép âm 1 (b, p, m, f, d, t)",
    image: { src: "/phat-am/trang-9.webp", width: 1491, height: 865 },
    description:
      "Bảng ghép âm thực hành số 1: luyện ghép các thanh mẫu môi và đầu lưỡi.",
  },
  10: {
    title: "Trang 10 – Bảng ghép âm 1 (n, l, g, k, h, zh, ch, sh, r, z, c, s)",
    image: { src: "/phat-am/trang-10.webp", width: 1491, height: 895 },
    description:
      "Bảng ghép âm thực hành số 1 (tiếp theo): luyện ghép các âm cuống lưỡi, cuốn lưỡi và đầu lưỡi trước.",
  },
  11: {
    title: "Trang 11 – Bảng ghép âm 2 (b, p, m, f, d, t, n, l, g, k, h, j, q)",
    image: { src: "/phat-am/trang-11.webp", width: 1492, height: 904 },
    description:
      "Bảng ghép âm thực hành số 2: luyện ghép các thanh mẫu với nhóm vận mẫu i và âm mặt lưỡi.",
  },
  12: {
    title: "Trang 12 – Bảng ghép âm 2 (x, zh, ch, sh, r, z, c, s)",
    image: { src: "/phat-am/trang-12.webp", width: 1491, height: 890 },
    description:
      "Bảng ghép âm thực hành số 2 (tiếp theo): luyện ghép dòng x và nhóm âm cuốn lưỡi, răng lưỡi.",
  },
  13: {
    title: "Trang 13 – Bảng ghép âm 3 (nhóm vận mẫu u)",
    image: { src: "/phat-am/trang-13.webp", width: 1492, height: 894 },
    description:
      "Bảng ghép âm thực hành số 3: luyện ghép thanh mẫu với nhóm vận mẫu u và biến thể.",
  },
};

export const PHAT_AM_TRACKS: readonly ListeningTrack[] = [
  {
    page: 2,
    title: "Trang 2 – Cấu trúc âm tiết: Thanh mẫu, Vận mẫu & Thanh điệu",
    src: "/audio/phat-am/trang-02.mp3",
    image: { src: "/phat-am/trang-2.webp", width: 1491, height: 900 },
  },
  {
    page: 3,
    title: "Trang 3 – Bốn thanh điệu cơ bản",
    src: "/audio/phat-am/trang-03.mp3",
    image: { src: "/phat-am/trang-3.webp", width: 1491, height: 930 },
  },
  {
    page: 4,
    title: "Trang 4 – Thanh nhẹ (Khinh thanh) & Luyện đọc",
    src: "/audio/phat-am/trang-04.mp3",
    image: { src: "/phat-am/trang-4.webp", width: 1491, height: 885 },
  },
  {
    page: 9,
    title: "Trang 9 – Bảng ghép âm 1 (b, p, m, f, d, t)",
    src: "/audio/phat-am/trang-09.mp3",
    image: { src: "/phat-am/trang-9.webp", width: 1491, height: 865 },
  },
  {
    page: 10,
    title: "Trang 10 – Bảng ghép âm 1 (n, l, g, k, h, zh, ch, sh, r, z, c, s)",
    src: "/audio/phat-am/trang-10.mp3",
    image: { src: "/phat-am/trang-10.webp", width: 1491, height: 895 },
  },
  {
    page: 11,
    title: "Trang 11 – Bảng ghép âm 2 (b, p, m, f, d, t, n, l, g, k, h, j, q)",
    src: "/audio/phat-am/trang-11.mp3",
    image: { src: "/phat-am/trang-11.webp", width: 1492, height: 904 },
  },
  {
    page: 12,
    title: "Trang 12 – Bảng ghép âm 2 (x, zh, ch, sh, r, z, c, s)",
    src: "/audio/phat-am/trang-12.mp3",
    image: { src: "/phat-am/trang-12.webp", width: 1491, height: 890 },
  },
  {
    page: 13,
    title: "Trang 13 – Bảng ghép âm 3 (nhóm vận mẫu u)",
    src: "/audio/phat-am/trang-13.mp3",
    image: { src: "/phat-am/trang-13.webp", width: 1492, height: 894 },
  },
];

export const PHAT_AM_AUDIO_PAGES = [
  ...new Set(PHAT_AM_TRACKS.map((track) => track.page)),
];
export const PHAT_AM_PAGES = PHAT_AM_AUDIO_PAGES;
export const PHAT_AM_ALL_PAGES = Array.from(
  { length: PHAT_AM_BOOK_PAGE_COUNT },
  (_, index) => index + 1,
);

export function phatAmPageHref(page: number) {
  return `/nghe/phat-am/trang-${page}`;
}

export function tracksForPhatAmPage(page: number) {
  return PHAT_AM_TRACKS.filter((track) => track.page === page);
}
