import { describe, expect, it } from "vitest";

import { groupDeliveriesByClass } from "@/features/assessment-results/group-deliveries";

/**
 * `UX-UIUX-M17-008` — logic gom nhóm theo lớp từng bị chép nguyên văn ở cả
 * `exercise-dashboard.tsx` (M16) lẫn `exam-dashboard.tsx` (M17).
 *
 * Test này khoá đúng những điểm mà hai bản chép có thể trôi khỏi nhau: thứ tự
 * nhóm, cách dựng nhãn, và cách xử lý lần giao chưa gắn lớp.
 */
describe("groupDeliveriesByClass", () => {
  const withClass = (code: string, name: string, id: string) => ({
    id,
    class: { code, name },
  });

  it("gom các lần giao cùng lớp vào một nhóm", () => {
    const groups = groupDeliveriesByClass([
      withClass("LOP-01", "HSK 1 buổi tối", "a"),
      withClass("LOP-02", "HSK 2", "b"),
      withClass("LOP-01", "HSK 1 buổi tối", "c"),
    ]);

    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ["a", "c"],
      ["b"],
    ]);
  });

  it("giữ thứ tự theo lần xuất hiện đầu tiên, không sắp xếp lại", () => {
    // Thứ tự do câu truy vấn quyết định; task UI/UX không được đổi (`DS-003`).
    const groups = groupDeliveriesByClass([
      withClass("LOP-09", "Giao tiếp", "a"),
      withClass("LOP-01", "HSK 1", "b"),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["LOP-09", "LOP-01"]);
  });

  it("dựng nhãn dạng `mã — tên lớp`", () => {
    const groups = groupDeliveriesByClass([withClass("LOP-01", "HSK 1", "a")]);

    expect(groups.map((group) => group.label)).toEqual(["LOP-01 — HSK 1"]);
  });

  it("gom lần giao chưa gắn lớp vào một nhóm `unassigned` có nhãn tiếng Việt", () => {
    const groups = groupDeliveriesByClass([
      { id: "a", class: null },
      { id: "b", class: null },
    ]);

    expect(
      groups.map((group) => ({
        key: group.key,
        label: group.label,
        ids: group.items.map((item) => item.id),
      })),
    ).toEqual([
      { key: "unassigned", label: "Chưa xác định lớp", ids: ["a", "b"] },
    ]);
  });

  it("trả mảng rỗng khi chưa có lần giao nào", () => {
    expect(groupDeliveriesByClass([])).toEqual([]);
  });
});
