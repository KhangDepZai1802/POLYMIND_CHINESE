/**
 * Gom danh sách lần giao (bài tập / kỳ thi) theo lớp.
 *
 * Vì sao tách ra: đúng 18 dòng này bị chép **nguyên văn** ở
 * `exercises/teacher/exercise-dashboard.tsx` (M16) và
 * `exams/teacher/exam-dashboard.tsx` (M17) — cùng thứ tự, cùng nhãn
 * "Chưa xác định lớp", cùng khóa `unassigned`. Đây đúng loại lỗi đã ghi ở
 * `UX-UIUX-M25-010`: ô số liệu bento chép ba bản rồi **trôi khác nhau ở chỗ
 * nhìn thấy được**. Gom trước khi nó kịp trôi.
 *
 * Giữ nguyên hành vi của cả hai bản cũ: thứ tự nhóm theo lần **xuất hiện đầu
 * tiên** trong mảng đầu vào (không sắp xếp lại), vì thứ tự đó do câu truy vấn
 * quyết định và task UI/UX không được đổi kết quả truy vấn (`DS-003`).
 */
export type DeliveryClassRef = { code: string; name: string } | null;

export type DeliveryGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

export function groupDeliveriesByClass<T extends { class: DeliveryClassRef }>(
  deliveries: readonly T[],
): Array<DeliveryGroup<T>> {
  return deliveries.reduce<Array<DeliveryGroup<T>>>((groups, delivery) => {
    const key = delivery.class?.code ?? "unassigned";
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = {
        key,
        label: delivery.class
          ? `${delivery.class.code} — ${delivery.class.name}`
          : "Chưa xác định lớp",
        items: [],
      };
      groups.push(group);
    }
    group.items.push(delivery);
    return groups;
  }, []);
}
