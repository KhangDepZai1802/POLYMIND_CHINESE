import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import fg from "fast-glob";
import { describe, expect, it } from "vitest";

/**
 * `UX-UIUX-M00-025` — **Server Component không được truyền React element vào
 * một prop rồi bị đưa xuống `asChild`.**
 *
 * Bệnh thật, đo được chứ không phải lo xa: `/admin/classes/[id]` truyền
 * `trigger={<Button>Sửa lớp</Button>}` từ Server Component vào `ClassFormDialog`
 * ("use client"), component này đặt nó vào `<DialogTrigger asChild>`. Element đi
 * qua ranh giới RSC nên **có lúc** Radix `Children.only()` không thấy đúng một
 * phần tử → ném *"Primitive.button failed to slot onto its children"* → React
 * bỏ cả cây và `(dashboard)/error.tsx` hiện lên.
 *
 * Vì sao phải khoá bằng bài kiểm TĨNH chứ không dựa vào E2E: lỗi chỉ xảy ra
 * **47/120 lượt** điều hướng (đo trên Pixel 7). Một bài E2E bắt được nó chỉ là
 * bài kiểm *chập chờn* — mà chập chờn thì còn tệ hơn không có (`DS-038`). Bài
 * này chạy trong vài mili giây và **tất định**: hoặc có chỗ vi phạm, hoặc không.
 *
 * Và đây cũng chính là lý do lỗi sống sót lâu: triệu chứng của nó (`h1 = 1`,
 * `h2 = 0` của trang lỗi) trùng khít với "màn này thiếu heading cấp 2", nên hai
 * đợt QA liền đã báo cáo nó thành lỗi a11y của sản phẩm.
 */

const SRC = join(process.cwd(), "src");

/** Prop nhận **element** rồi được component con đặt vào `asChild`. */
const ELEMENT_PROPS = ["trigger"];

function isClientFile(source: string): boolean {
  // Chỉ thị phải nằm ở đầu file (cho phép comment/khoảng trắng đứng trước).
  return /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*["']use client["']/.test(source);
}

describe("UX-UIUX-M00-025 — ranh giới RSC và Radix asChild", () => {
  it("không Server Component nào truyền element qua prop `trigger`", async () => {
    const files = await fg("**/*.tsx", { cwd: SRC, absolute: true });

    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (isClientFile(source)) continue;

      for (const prop of ELEMENT_PROPS) {
        const pattern = new RegExp(`\\b${prop}=\\{`, "g");
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(source)) !== null) {
          const line = source.slice(0, match.index).split("\n").length;
          offenders.push(`${relative(process.cwd(), file)}:${line} — ${prop}={…}`);
        }
      }
    }

    expect(
      offenders,
      [
        "Server Component đang truyền element qua prop element-props.",
        "Sửa: để chính Client Component dựng nút của nó (thường suy ra từ",
        "cờ `isEdit`/`version` sẵn có), đừng đẩy element qua ranh giới RSC.",
        ...offenders,
      ].join("\n"),
    ).toEqual([]);
  });

  it("bài kiểm này thật sự bắt được vi phạm (kiểm ngược)", () => {
    // Nếu `isClientFile` nhận nhầm mọi file là client thì bài trên luôn xanh mà
    // chẳng kiểm gì — chốt lại bằng hai mẫu đối chứng.
    expect(isClientFile('"use client";\n\nimport x from "y";')).toBe(true);
    expect(isClientFile("// ghi chú\n'use client';\n")).toBe(true);
    expect(isClientFile('import Link from "next/link";\n')).toBe(false);
    // …và chuỗi "use client" nằm giữa file thì KHÔNG tính là chỉ thị.
    expect(isClientFile('import x from "y";\nconst s = "use client";')).toBe(false);
  });
});
