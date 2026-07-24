import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StudentStatCard } from "@/components/shared/student-stat-card";

const ROOT = process.cwd();

/**
 * `P15-T9` — ô số liệu bento dùng chung của khu vực Học viên.
 *
 * Trước khi gom, ba màn `/student`, `/student/results` và `/student/tuition`
 * mỗi màn giữ một bản sao. Ba bản đã trôi khác nhau ở chỗ người dùng nhìn
 * thấy: chỉ Học phí có `tabular-nums` nên cột số của nó thẳng hàng còn hai màn
 * kia thì không. Bộ test này khoá cả hai mặt — hành vi của component, và việc
 * ba màn thật sự dùng nó chứ không chép lại.
 */
describe("StudentStatCard", () => {
  it("hiện nhãn, giá trị và dòng phụ", () => {
    render(
      <StudentStatCard
        icon={Wallet}
        tone="coral"
        label="Còn phải đóng"
        value="1.200.000 ₫"
        hint="2 hóa đơn quá hạn"
      />,
    );

    expect(screen.getByText("Còn phải đóng")).toBeInTheDocument();
    expect(screen.getByText("1.200.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("2 hóa đơn quá hạn")).toBeInTheDocument();
  });

  it("bỏ hẳn dòng phụ khi không truyền `hint` thay vì để lại dòng trống", () => {
    const { container } = render(
      <StudentStatCard
        icon={Wallet}
        tone="sky"
        label="Tổng hóa đơn"
        value="0 ₫"
      />,
    );

    // Chỉ còn 2 thẻ <p>: nhãn và giá trị.
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("luôn dùng `tabular-nums` cho giá trị để các ô thẳng cột", () => {
    render(
      <StudentStatCard icon={Wallet} tone="amber" label="Bài chưa nộp" value={3} />,
    );

    expect(screen.getByText("3")).toHaveClass("tabular-nums");
  });

  it("nhận `value` dạng số mà không cần nơi gọi tự đổi sang chuỗi", () => {
    render(
      <StudentStatCard icon={Wallet} tone="cyan" label="Hóa đơn quá hạn" value={0} />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("ba màn học viên đều import component dùng chung, không chép lại", () => {
    const consumers = [
      "src/app/(dashboard)/student/page.tsx",
      "src/app/(dashboard)/student/results/page.tsx",
      "src/features/tuition/components/student-tuition-overview.tsx",
    ];

    for (const relative of consumers) {
      const source = readFileSync(join(ROOT, relative), "utf8");

      expect(source, `${relative} phải import StudentStatCard`).toContain(
        'from "@/components/shared/student-stat-card"',
      );
      // Bản sao cũ luôn kèm theo một bảng tone khai báo tại chỗ — còn bảng đó
      // nghĩa là còn bản sao, và hai bản sẽ lại trôi khác nhau lần nữa.
      // (Class `border-student-*` dùng trực tiếp cho thẻ khác thì vẫn được, nên
      // chỉ bắt đúng khai báo bảng tone.)
      expect(
        source,
        `${relative} không được khai báo lại bảng tone của ô số liệu`,
      ).not.toMatch(/const (STUDENT_STAT_TONES|SUMMARY_TONES)\b/);
    }
  });
});
