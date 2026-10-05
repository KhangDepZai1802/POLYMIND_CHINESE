export type ListeningTrack = {
  page: number;
  title: string;
  src: string;
  image?: {
    src: string;
    width: number;
    height: number;
  };
};

export const LISTENING_BOOK_PAGE_COUNT = 30;

export const LISTENING_TRACKS: readonly ListeningTrack[] = [
  {
    page: 1,
    title: "Trang 1 – Từ vựng về giờ, phút",
    src: "/audio/bai-3/trang-01.m4a",
    image: {
      src: "/bai3/trang1.png",
      width: 1199,
      height: 1312,
    },
  },
  {
    page: 2,
    title: "Trang 2 – Cách nói giờ chẵn",
    src: "/audio/bai-3/trang-02-phan-1.m4a",
    image: {
      src: "/bai3/trang2-phan1.png",
      width: 1774,
      height: 887,
    },
  },
  {
    page: 2,
    title: "Trang 2 – Cách nói giờ và phút",
    src: "/audio/bai-3/trang-02-phan-2.m4a",
    image: {
      src: "/bai3/trang2-phan2.png",
      width: 1622,
      height: 969,
    },
  },
  {
    page: 4,
    title: "Trang 4 – Cách nói giờ rưỡi",
    src: "/audio/bai-3/trang-04-phan-3.m4a",
    image: { src: "/bai3/trang4-phan3.png", width: 1618, height: 972 },
  },
  {
    page: 4,
    title: "Trang 4 – Cách nói giờ kém",
    src: "/audio/bai-3/trang-04-phan-4.m4a",
    image: { src: "/bai3/trang4-phan4.png", width: 1500, height: 1049 },
  },
  {
    page: 6,
    title: "Trang 6 – Cách nói giờ theo khắc",
    src: "/audio/bai-3/trang-06.m4a",
    image: { src: "/bai3/trang6.png", width: 1122, height: 1402 },
  },
  {
    page: 8,
    title: "Trang 8 – Hỏi bây giờ là mấy giờ",
    src: "/audio/bai-3/trang-08-phan-6.m4a",
    image: { src: "/bai3/trang8-phan6.png", width: 1681, height: 936 },
  },
  {
    page: 8,
    title: "Trang 8 – Hỏi chính xác giờ và phút",
    src: "/audio/bai-3/trang-08-phan-7.m4a",
    image: { src: "/bai3/trang8-phan7.png", width: 1669, height: 942 },
  },
  {
    page: 9,
    title: "Trang 9 – Hội thoại",
    src: "/audio/bai-3/trang-09.mp3",
    image: { src: "/bai3/trang9.png", width: 1191, height: 1320 },
  },
  {
    page: 12,
    title: "Trang 12 – Các buổi trong ngày",
    src: "/audio/bai-3/trang-12-phan-1.m4a",
    image: { src: "/bai3/trang12-phan1.png", width: 1471, height: 1069 },
  },
  {
    page: 12,
    title: "Trang 12 – Đơn vị ngày tháng",
    src: "/audio/bai-3/trang-12-phan-2.m4a",
    image: { src: "/bai3/trang12-phan2.png", width: 2014, height: 780 },
  },
  {
    page: 13,
    title: "Trang 13 – Các thứ trong tuần",
    src: "/audio/bai-3/trang-13-phan-3.m4a",
    image: { src: "/bai3/trang13-phan3.png", width: 1584, height: 993 },
  },
  {
    page: 13,
    title: "Trang 13 – Các tháng trong năm",
    src: "/audio/bai-3/trang-13-phan-4.m4a",
    image: { src: "/bai3/trang13-phan4.png", width: 1527, height: 1030 },
  },
  {
    page: 14,
    title: "Trang 14 – Hôm qua, hôm nay, ngày mai",
    src: "/audio/bai-3/trang-14-phan-1.m4a",
    image: { src: "/bai3/trang14-phan1.png", width: 1921, height: 819 },
  },
  {
    page: 14,
    title: "Trang 14 – Năm ngoái, năm nay, năm sau",
    src: "/audio/bai-3/trang-14-phan-2.m4a",
    image: { src: "/bai3/trang14-phan2.png", width: 1880, height: 836 },
  },
  {
    page: 15,
    title: "Trang 15 – Tuần và tháng",
    src: "/audio/bai-3/trang-15-phan-3.m4a",
    image: { src: "/bai3/trang15-phan3.png", width: 1726, height: 911 },
  },
  {
    page: 15,
    title: "Trang 15 – Cách diễn tả ngày tháng",
    src: "/audio/bai-3/trang-15-phan-iii.m4a",
    image: {
      src: "/bai3/trang15-phan-iii.png",
      width: 1595,
      height: 986,
    },
  },
  {
    page: 16,
    title: "Trang 16 – Hỏi ngày tháng",
    src: "/audio/bai-3/trang-16-phan-1.m4a",
    image: { src: "/bai3/trang16-phan1.png", width: 1727, height: 910 },
  },
  {
    page: 16,
    title: "Trang 16 – Hỏi thứ trong tuần",
    src: "/audio/bai-3/trang-16-phan-2.m4a",
    image: { src: "/bai3/trang16-phan2.png", width: 1615, height: 974 },
  },
  {
    page: 17,
    title: "Trang 17 – Hỏi giờ",
    src: "/audio/bai-3/trang-17-phan-3.m4a",
    image: { src: "/bai3/trang17-phan3.png", width: 1701, height: 925 },
  },
  {
    page: 17,
    title: "Trang 17 – Từ vựng: Mời bạn ăn cơm",
    src: "/audio/bai-3/trang-17-tu-vung.m4a",
    image: { src: "/bai3/trang17-tu-vung.png", width: 1584, height: 993 },
  },
  {
    page: 18,
    title: "Trang 18 – Hội thoại mẫu: Mời bạn ăn cơm",
    src: "/audio/bai-3/trang-18.m4a",
    image: { src: "/bai3/trang18.png", width: 1193, height: 1318 },
  },
] as const;

export const LISTENING_PAGES = [
  ...new Set(LISTENING_TRACKS.map((track) => track.page)),
];

export function listeningPageHref(page: number) {
  return `/nghe/trang-${page}`;
}

export function tracksForPage(page: number) {
  return LISTENING_TRACKS.filter((track) => track.page === page);
}
