import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { TabsContent } from "@/components/ui/tabs";

/**
 * `UX-MOBILE-1` — user bác bỏ hẳn dải tab cuộn ngang trên điện thoại:
 * *"việc cuộn ngang này có thể khiến người ta không biết là phải cuộn ngang
 * hả"*. Bài ở đây ghim ba điều: không còn khung cuộn, nút chọn nói rõ có bao
 * nhiêu mục, và chọn mục trong bảng trượt thì nội dung đổi thật.
 */

const ITEMS = [
  { value: "overview", label: "Tổng quan" },
  { value: "schedule", label: "Lịch/Buổi" },
  { value: "exercises", label: "Bài tập" },
  { value: "materials", label: "Tài liệu" },
];

function renderTabs() {
  return render(
    <ResponsiveTabs
      label="Nội dung lớp học"
      defaultValue="overview"
      items={ITEMS}
    >
      <TabsContent value="overview">Nội dung tổng quan</TabsContent>
      <TabsContent value="schedule">Nội dung lịch</TabsContent>
      <TabsContent value="exercises">Nội dung bài tập</TabsContent>
      <TabsContent value="materials">Nội dung tài liệu</TabsContent>
    </ResponsiveTabs>,
  );
}

describe("ResponsiveTabs", () => {
  it("KHÔNG đặt dải tab trong khung cuộn ngang", () => {
    renderTabs();

    const list = screen.getByRole("tablist");
    expect(list.closest(".overflow-x-auto")).toBeNull();
    // `min-w-max` là thứ ép dải tab rộng hơn khung — không được còn.
    expect(list.className).not.toContain("min-w-max");
    expect(list.className).toContain("flex-wrap");
  });

  it("nút chọn nói rõ đang ở mục nào trên tổng bao nhiêu mục", () => {
    renderTabs();

    // Con số `1/4` chính là thứ thay cho affordance mà vùng cuộn ngang không
    // có: nhìn một cái là biết còn 3 mục nữa.
    const picker = screen.getByRole("button", { name: /Tổng quan/ });
    expect(picker).toHaveTextContent("1/4");
  });

  it("chọn mục trong bảng trượt thì nội dung đổi theo", async () => {
    const user = userEvent.setup();
    renderTabs();

    expect(screen.getByText("Nội dung tổng quan")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Tổng quan/ }));
    await user.click(screen.getByRole("button", { name: "Bài tập" }));

    expect(screen.getByText("Nội dung bài tập")).toBeInTheDocument();
    expect(screen.queryByText("Nội dung tổng quan")).not.toBeInTheDocument();
    // Bảng trượt phải tự đóng sau khi chọn, không bắt người dùng bấm ✕.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("giữ nguyên dải tab đầy đủ cho màn rộng và trình đọc màn hình", () => {
    renderTabs();

    expect(screen.getAllByRole("tab")).toHaveLength(ITEMS.length);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("dải tab lái bằng URL thì mục trong bảng trượt là liên kết", async () => {
    const user = userEvent.setup();
    render(
      <ResponsiveTabs
        label="Khu vực của lớp"
        value="overview"
        items={ITEMS.map((item) => ({
          ...item,
          href: `/teacher/classes/abc?tab=${item.value}`,
        }))}
      >
        <TabsContent value="overview">Nội dung tổng quan</TabsContent>
      </ResponsiveTabs>,
    );

    await user.click(screen.getByRole("button", { name: /Tổng quan/ }));

    expect(screen.getByRole("link", { name: "Bài tập" })).toHaveAttribute(
      "href",
      "/teacher/classes/abc?tab=exercises",
    );
  });
});
