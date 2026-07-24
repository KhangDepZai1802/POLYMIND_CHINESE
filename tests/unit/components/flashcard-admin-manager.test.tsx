import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FlashcardAdminManager } from "@/features/flashcards/components/flashcard-admin-manager";
import { archiveFlashcardSectionPagesAction } from "@/features/flashcards/server/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/flashcards/server/actions", () => ({
  archiveFlashcardDeckSectionsAction: vi.fn(),
  archiveFlashcardPageAction: vi.fn(),
  archiveFlashcardSectionPagesAction: vi.fn(),
  createFlashcardSectionsAction: vi.fn(),
  createFlashcardUploadTicketsAction: vi.fn(),
  discardFlashcardUploadsAction: vi.fn(),
  moveFlashcardPageAction: vi.fn(),
  publishFlashcardSectionAction: vi.fn(),
  saveFlashcardDeckAction: vi.fn(),
  saveFlashcardPageAction: vi.fn(),
  saveFlashcardSectionAction: vi.fn(),
  unpublishFlashcardSectionAction: vi.fn(),
}));

const course = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "HSK1",
  title: "HSK 1",
  defaultSessionCount: 1,
  deck: { id: "22222222-2222-4222-8222-222222222222", status: "draft" },
} as const;

const deck = {
  id: course.deck.id,
  course_id: course.id,
  title: "Flashcard HSK 1",
  description: "Ôn từ vựng",
  status: "draft",
  created_by: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
  sections: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      deck_id: course.deck.id,
      session_number: 1,
      title: "Chào hỏi",
      status: "draft",
      published_at: null,
      created_by: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-07-21T00:00:00Z",
      updated_at: "2026-07-21T00:00:00Z",
      pages: [],
    },
  ],
} as const;

const basePage = {
  section_id: deck.sections[0].id,
  front_image_path: "front.png",
  back_image_path: "back.png",
  front_alt: "mặt trước",
  back_alt: "mặt sau",
  created_by: "33333333-3333-4333-8333-333333333333",
  archived_at: null,
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
  media_paths: ["front.png", "back.png"],
  example_sentences: [],
  common_phrases: [],
  frontUrl: null,
  backUrl: null,
  audioUrl: null,
  mediaUrls: {},
} as const;

const deckWithPages = {
  ...deck,
  sections: [
    {
      ...deck.sections[0],
      pages: [
        {
          ...basePage,
          id: "55555555-5555-4555-8555-555555555551",
          kind: "session_cover",
          order_index: 0,
          hanzi: null,
          pinyin_syllables: null,
          meaning_vi: null,
          audio_path: null,
        },
        {
          ...basePage,
          id: "55555555-5555-4555-8555-555555555552",
          kind: "vocabulary",
          order_index: 1,
          hanzi: "你好",
          pinyin_syllables: "nǐ hǎo",
          meaning_vi: "Xin chào",
          audio_path: "audio.mp3",
        },
      ],
    },
  ],
} as const;

describe("FlashcardAdminManager", () => {
  it("hiển thị mục lục buổi, trạng thái và khóa nút thêm khi đã đủ số buổi", () => {
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deck as never}
      />,
    );

    expect(screen.getByText("Flashcard HSK 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buổi 1" })).toBeInTheDocument();
    expect(screen.getByText("Buổi 1 · Chào hỏi")).toBeInTheDocument();
    expect(screen.getByText("Đã đủ số buổi")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thêm buổi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Công bố buổi" }),
    ).toBeInTheDocument();
  });

  it("cho phép lưu trữ cả trang mở đầu lẫn trang từ vựng ở buổi nháp", () => {
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deckWithPages as never}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Lưu trữ trang mở đầu" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Lưu trữ 你好" })).toBeEnabled();
    // Còn trang mở đầu thì trang từ vựng đầu tiên không được đẩy lên vị trí 0.
    expect(screen.getByRole("button", { name: "Đưa 你好 lên" })).toBeDisabled();
  });

  it("🔴 danh sách trang xem trước ĐÚNG MẶT THẺ học viên thấy, không phải ảnh thô", () => {
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deckWithPages as never}
      />,
    );

    // Mốc phải là thứ CHỈ mặt thẻ học viên mới có. Chữ "你好"/"Xin chào" không
    // dùng được: dòng mô tả bên cạnh ô xem trước cũng in đúng hai chữ đó, nên
    // bài kiểm sẽ xanh cả khi ô xem trước rỗng. Tiêu đề khối của mặt sau
    // (`VocabularyBack`) thì chỉ tồn tại trong chính mặt thẻ.
    // Tra với `hidden: true` vì ô thu nhỏ cố ý mang `aria-hidden` — thông tin
    // của thẻ đã có dạng chữ ngay bên cạnh, đọc lại lần nữa bằng trình đọc màn
    // hình chỉ làm dài thêm. Hai vế dưới ghim CẢ HAI điều: mặt thẻ có thật
    // trong DOM, và nó KHÔNG lọt vào cây trợ năng.
    expect(
      screen.getByRole("heading", { name: "Thẻ", hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nghĩa", hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Thẻ" }),
    ).not.toBeInTheDocument();

    // Bấm để phóng to — vì mặt sau cao ~560px, thu về ô 150px thì không đọc nổi.
    expect(
      screen.getByRole("button", { name: "Phóng to mặt trước của thẻ 你好" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Phóng to mặt sau của thẻ 你好" }),
    ).toBeInTheDocument();

    // Bản cũ in "Không có ảnh" cho thẻ chữ thuần — đúng theo tiêu chí của chính
    // nó, nhưng nói sai về sản phẩm: từ Phase 16 thẻ được dựng BẰNG CHỮ.
    expect(screen.queryByText("Không có ảnh")).not.toBeInTheDocument();
  });

  it("🔴 nút xoá hàng loạt nằm ở VÙNG NGUY HIỂM, tách khỏi cụm nút thường", () => {
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deckWithPages as never}
      />,
    );

    const addPage = screen.getByRole("button", { name: "Thêm trang" });
    const clearPages = screen.getByRole("button", {
      name: "Xoá tất cả trang trong buổi 1",
    });
    const clearSections = screen.getByRole("button", {
      name: "Xoá tất cả buổi của bộ thẻ",
    });

    expect(
      screen.getByRole("heading", { name: /Vùng nguy hiểm/ }),
    ).toBeInTheDocument();

    // Đây mới là điều bài kiểm này thật sự canh: hai nút phá huỷ KHÔNG được
    // nằm cùng hàng với "Thêm trang". Đặt cạnh nhau thì một cú bấm trượt là
    // xoá sạch buổi vừa soạn (`destructive-nav-separation`).
    expect(addPage.parentElement).not.toBe(clearPages.parentElement);
    expect(addPage.parentElement).not.toBe(clearSections.parentElement);
    expect(
      screen
        .getByRole("heading", { name: /Vùng nguy hiểm/ })
        .closest("section")
        ?.contains(clearPages),
    ).toBe(true);
    expect(
      screen
        .getByRole("heading", { name: /Vùng nguy hiểm/ })
        .closest("section")
        ?.contains(addPage),
    ).toBe(false);
  });

  it("nút xoá mở hộp thoại xác nhận, KHÔNG xoá thẳng khi bấm", async () => {
    const user = userEvent.setup();
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deckWithPages as never}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Xoá tất cả trang trong buổi 1" }),
    );

    // `D-35` điểm 4: hộp thoại xác nhận THƯỜNG, nút Xoá destructive, không bắt
    // gõ lại tên buổi.
    expect(
      await screen.findByRole("alertdialog", {
        name: /Xoá tất cả 2 trang của buổi 1/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeInTheDocument();
    expect(archiveFlashcardSectionPagesAction).not.toHaveBeenCalled();
  });
});
