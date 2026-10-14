import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModuleSwitcher } from "@/components/layout/module-switcher";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/xkld/candidates",
}));
// Keep the shared layout mounted, as it remains during App Router navigation.
vi.mock("next/link", () => ({
  default: ({ href, ...props }: ComponentProps<"a">) => (
    <a {...props} href="#" data-destination={href} />
  ),
}));

describe("module switcher", () => {
  it.each(["Doanh nghiệp (B2B)", "Lớp trung tâm (B2C)", "Xuất khẩu lao động"])(
    "closes after selecting %s and can reopen",
    (name) => {
      render(<ModuleSwitcher role="super_admin" />);
      fireEvent.click(
        screen.getByRole("button", { name: "Mở danh sách module" }),
      );
      fireEvent.click(
        screen.getByRole("link", {
          name: new RegExp(name.replace(/[()]/g, "\\$&")),
        }),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Mở danh sách module" }),
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(
      screen.getByRole("button", { name: "Close" }),
      );
    },
  );
});
