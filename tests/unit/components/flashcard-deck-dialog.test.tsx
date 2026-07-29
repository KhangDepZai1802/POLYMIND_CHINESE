import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FlashcardDeckDialog } from "@/features/flashcards/components/flashcard-deck-dialog";
import { saveFlashcardDeckAction } from "@/features/flashcards/server/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/flashcards/server/actions", () => ({
  saveFlashcardDeckAction: vi.fn(),
}));

vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.polymind.vn");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

const course = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "VCB-EXEC",
  title: "Tiếng Trung Đàm Phán",
  defaultSessionCount: 35,
  deckCount: 1,
} as const;

/** Đúng tình huống user gặp: bộ đã phát hành đủ 35 mã QR nên mã bị khoá. */
const lockedDeck = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "vcb-exec",
  title: "Flashcard — Tiếng Trung Đàm Phán",
  description: "Mô tả cũ",
  status: "draft",
  sectionCount: 35,
  publishedSectionCount: 0,
  liveLinkCount: 35,
} as const;

function renderDialog(deck: { liveLinkCount: number } & Record<string, unknown>) {
  return render(
    <FlashcardDeckDialog
      open
      onOpenChange={vi.fn()}
      course={course as never}
      deck={deck as never}
      suggestedCode="vcb-exec-2"
    />,
  );
}

describe("FlashcardDeckDialog", () => {
  beforeEach(() => {
    vi.mocked(saveFlashcardDeckAction).mockReset();
    vi.mocked(saveFlashcardDeckAction).mockResolvedValue({
      success: "Đã lưu bộ flashcard.",
    });
  });

  /**
   * 🔴 Bài kiểm sinh ra từ một lỗi THẬT: bộ còn liên kết sống thì không đổi nổi
   * cả TÊN, dù tên chẳng liên quan gì tới mã QR.
   *
   * Nguyên nhân là một chi tiết của nền tảng chứ không phải của nghiệp vụ: ô
   * `disabled` **không được gửi kèm `FormData`**, nên `code` tới Zod là
   * `undefined` và form đỏ ngay ở tầng xác thực — người dùng thấy đúng dòng
   * *"Invalid input: expected string, received undefined"* dưới ô mã.
   *
   * Nên bài kiểm ghim vào thứ đã gãy — **`code` phải có mặt trong `FormData`** —
   * chứ không ghim vào thuộc tính `readOnly`. Ghim thuộc tính thì đổi cách sửa
   * (ví dụ dùng input ẩn) là đỏ oan, mà vẫn không chứng minh được form gửi đi
   * cái gì.
   */
  it("🔴 bộ còn liên kết sống: vẫn đổi được TÊN, và mã cũ vẫn được gửi kèm", async () => {
    const user = userEvent.setup();
    renderDialog(lockedDeck);

    const title = screen.getByLabelText("Tên bộ *");
    await user.clear(title);
    await user.type(title, "Mẫu Câu Tác Chiến");
    await user.click(screen.getByRole("button", { name: "Lưu bộ flashcard" }));

    await waitFor(() =>
      expect(saveFlashcardDeckAction).toHaveBeenCalledOnce(),
    );
    const sent = vi.mocked(saveFlashcardDeckAction).mock.calls[0]![0];
    expect(sent.get("title")).toBe("Mẫu Câu Tác Chiến");
    expect(sent.get("code")).toBe("vcb-exec");
    expect(sent.get("id")).toBe(lockedDeck.id);
  });

  /**
   * Khoá mã là để GIẢI THÍCH, không phải để thay chỗ cho chốt chặn ở DB
   * (`trg_flashcard_decks_guard_code`). Ở tầng giao diện chỉ cần hai điều: gõ
   * không ăn, và lý do nói thẳng ra bằng chữ.
   */
  it("bộ còn liên kết sống: ô mã không gõ được và nói rõ lý do", async () => {
    const user = userEvent.setup();
    renderDialog(lockedDeck);

    const code = screen.getByLabelText("Mã bộ *");
    await user.type(code, "xxx");
    expect(code).toHaveValue("vcb-exec");
    expect(screen.getByText(/không đổi được mã/)).toBeInTheDocument();
  });

  /**
   * Bộ chưa phát hành mã nào thì mã vẫn sửa được — khoá phải CÓ ĐIỀU KIỆN, nếu
   * không thì bản sửa lỗi đổi tên hoá ra chỉ là khoá cứng mọi bộ.
   *
   * 🔴 `MULTIDECK-1g` — gõ mã CÓ DẤU GẠCH NỐI, đúng thứ trước đây không gõ nổi:
   * `onChange` chạy `flashcardDeckCodeSlug` sau từng phím, mà hàm ấy cắt gạch ở
   * cuối ⇒ `vcb-` ra `vcb`, phím kế dính liền. Bài này gõ thật từng phím nên nó
   * bắt đúng cái vòng lặp đã gãy.
   */
  it("🔴 bộ chưa có liên kết: gõ được mã CÓ dấu gạch nối, và địa chỉ xem trước bám theo", async () => {
    const user = userEvent.setup();
    renderDialog({ ...lockedDeck, liveLinkCount: 0 });

    const code = screen.getByLabelText("Mã bộ *");
    await user.clear(code);
    await user.type(code, "VCB Ngu Phap");
    // Chuẩn hoá ngay trên ô nhập: cái nhìn thấy chính là cái sẽ lưu.
    expect(code).toHaveValue("vcb-ngu-phap");
    expect(
      screen.getByText("https://www.polymind.vn/t/vcb-ngu-phap-01"),
    ).toBeInTheDocument();
  });

  /**
   * Địa chỉ xem trước là thứ người dùng đối chiếu với BẢN IN, nên nó không được
   * hiện một địa chỉ sẽ không bao giờ tồn tại. Giữa chừng lúc gõ, `code` mang
   * dấu gạch cuối — nối thẳng vào sẽ ra `/t/vcb--01`.
   */
  it("đang gõ dở (còn dấu gạch cuối) thì địa chỉ xem trước vẫn là địa chỉ THẬT", async () => {
    const user = userEvent.setup();
    renderDialog({ ...lockedDeck, liveLinkCount: 0 });

    const code = screen.getByLabelText("Mã bộ *");
    await user.clear(code);
    await user.type(code, "vcb-");
    expect(code).toHaveValue("vcb-");
    expect(
      screen.getByText("https://www.polymind.vn/t/vcb-01"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("https://www.polymind.vn/t/vcb--01"),
    ).not.toBeInTheDocument();
  });

  /** Rời ô thì chốt lại bản chuẩn — gạch thừa ở cuối biến mất. */
  it("rời ô nhập thì mã được chốt về bản chuẩn hoá cuối cùng", async () => {
    const user = userEvent.setup();
    renderDialog({ ...lockedDeck, liveLinkCount: 0 });

    const code = screen.getByLabelText("Mã bộ *");
    await user.clear(code);
    await user.type(code, "vcb-bank-");
    await user.tab();
    expect(code).toHaveValue("vcb-bank");
  });
});
