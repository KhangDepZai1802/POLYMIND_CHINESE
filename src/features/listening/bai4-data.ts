import type { ListeningTrack } from "./data";

export const BAI4_TITLE = "Bài 4 – Phương hướng, địa điểm";
export const BAI4_BOOK_PAGE_COUNT = 42;
export const BAI4_TRACKS: readonly ListeningTrack[] = [
  {
    page: 2,
    title: "Trang 2 – Từ vựng: Bạn đi đâu?",
    src: "/audio/bai-4/trang-02.m4a",
    image: { src: "/bai4/trang-2.webp", width: 1192, height: 1684 },
  },
  {
    page: 4,
    title: "Trang 4 – Hỏi và trả lời: Bạn đi đâu?",
    src: "/audio/bai-4/trang-04.m4a",
    image: { src: "/bai4/trang-4.webp", width: 1192, height: 1684 },
  },
  {
    page: 5,
    title: "Trang 5 – Các từ chỉ phương hướng",
    src: "/audio/bai-4/trang-05.m4a",
    image: { src: "/bai4/trang-5.webp", width: 1192, height: 1684 },
  },
  {
    page: 6,
    title: "Trang 6 – Hỏi và trả lời về vị trí",
    src: "/audio/bai-4/trang-06.m4a",
    image: { src: "/bai4/trang-6.webp", width: 1192, height: 1684 },
  },
  {
    page: 7,
    title: "Trang 7 – Hội thoại: Đi siêu thị",
    src: "/audio/bai-4/trang-07.m4a",
    image: { src: "/bai4/trang-7.webp", width: 1192, height: 1684 },
  },
  {
    page: 25,
    title: "Trang 25 – Từ vựng: Đi như thế nào?",
    src: "/audio/bai-4/trang-25.m4a",
    image: { src: "/bai4/trang-25.webp", width: 1192, height: 1684 },
  },
  {
    page: 26,
    title: "Trang 26 – Cách hỏi đường",
    src: "/audio/bai-4/trang-26.m4a",
    image: { src: "/bai4/trang-26.webp", width: 1192, height: 1684 },
  },
  {
    page: 29,
    title: "Trang 29 – Cách diễn tả thứ tự hành động",
    src: "/audio/bai-4/trang-29.m4a",
    image: { src: "/bai4/trang-29.webp", width: 1192, height: 1684 },
  },
  {
    page: 30,
    title: "Trang 30 – Hội thoại hỏi đường",
    src: "/audio/bai-4/trang-30.m4a",
    image: { src: "/bai4/trang-30.webp", width: 1192, height: 1684 },
  },
];
export const BAI4_PAGES = [...new Set(BAI4_TRACKS.map((track) => track.page))];
export function bai4PageHref(page: number) {
  return `/nghe/bai-4/trang-${page}`;
}
export function tracksForBai4Page(page: number) {
  return BAI4_TRACKS.filter((track) => track.page === page);
}
