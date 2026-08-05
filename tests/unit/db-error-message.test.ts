import { describe, expect, it } from "vitest";

import { dbErrorToMessage } from "@/lib/action-state";

/**
 * Ghim `dbErrorToMessage` (`VIDEO-1`, sửa 2026-08-05).
 *
 * Vì sao có bài này: user báo *"lỗi không tạo được bộ video"* trên production và
 * màn hình chỉ nói **"Không thực hiện được. Vui lòng thử lại."**. Nguyên nhân
 * thật là **bảng chưa tồn tại vì migration chưa chạy** — mã `42P01` rơi vào
 * nhánh `default`, nên người dùng bấm lại mười lần cũng không bao giờ khác, còn
 * người sửa thì không có một manh mối nào.
 *
 * "Deploy code trước, quên chạy migration" là lỗi vận hành sẽ còn lặp lại ở mọi
 * tính năng sau này, nên thông báo phải tự chỉ ra nguyên nhân.
 */
describe("dbErrorToMessage", () => {
  /**
   * 🔴 `PGRST205` là mã THẬT mà app nhận được, đã đo trên REST local:
   *   bảng lạ → HTTP 404 `{"code":"PGRST205","message":"Could not find the table
   *   'public.…' in the schema cache"}`
   *
   * Bản sửa đầu tiên chỉ bắt `42P01` (mã của Postgres) và **hoàn toàn vô dụng**,
   * vì supabase-js đi qua PostgREST mà PostgREST không chuyển tiếp mã Postgres.
   * Bài này tồn tại để không ai "dọn dẹp" mất nhánh PGRST rồi tưởng vẫn chạy.
   */
  it("🔴 bảng chưa tồn tại (PGRST205 — mã THẬT của PostgREST) phải nói ra là thiếu migration", () => {
    const message = dbErrorToMessage({
      code: "PGRST205",
      message: "Could not find the table 'public.video_collections' in the schema cache",
    });

    expect(message).toContain("migration");
    expect(message).not.toBe("Không thực hiện được. Vui lòng thử lại.");
  });

  it("RPC chưa tồn tại (PGRST202) cũng vậy", () => {
    expect(dbErrorToMessage({ code: "PGRST202" })).toContain("migration");
  });

  it("giữ luôn mã Postgres cho đường chạy SQL thẳng (script, pgTAP)", () => {
    expect(dbErrorToMessage({ code: "42P01" })).toContain("migration");
    expect(dbErrorToMessage({ code: "42883" })).toContain("migration");
  });

  it("KHÔNG rò chi tiết schema ra giao diện", () => {
    // Thông điệp gốc lộ tên bảng/constraint — miễn phí cho kẻ tấn công, vô
    // nghĩa với người dùng.
    const message = dbErrorToMessage({
      code: "PGRST205",
      message: "Could not find the table 'public.video_collections' in the schema cache",
    });

    expect(message).not.toContain("video_collections");
    expect(message).not.toContain("schema cache");
  });

  it("các mã đã có từ trước không đổi nghĩa", () => {
    expect(dbErrorToMessage({ code: "23505" })).toContain("đã tồn tại");
    expect(dbErrorToMessage({ code: "42501" })).toContain("không có quyền");
  });

  it("P0001 giữ nguyên câu do chính RPC của ta viết — đó là câu tiếng Việt an toàn", () => {
    expect(
      dbErrorToMessage({ code: "P0001", message: "Bộ video đã công bố." }),
    ).toBe("Bộ video đã công bố.");
  });

  it("mã lạ vẫn rơi về câu chung, không ném lỗi", () => {
    expect(dbErrorToMessage({ code: "XX999" })).toBe(
      "Không thực hiện được. Vui lòng thử lại.",
    );
    expect(dbErrorToMessage(null)).toBe("Không thực hiện được. Vui lòng thử lại.");
  });
});
