"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";

import { useNavProgress } from "@/components/shared/use-nav-progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClassOption = { id: string; code: string; name: string };

/**
 * Chọn lớp → đổi URL (`?class=<id>`).
 *
 * Trạng thái nằm ở URL chứ không ở React state: người dùng gửi được link "lịch
 * của LOP-02" cho đồng nghiệp, và nút back của trình duyệt hoạt động đúng.
 *
 * ⚠️ Nhãn là **bắt buộc**, không phải trang trí. `SelectTrigger` của Radix
 * render `role="combobox"`, mà `combobox` KHÔNG thuộc nhóm role lấy tên từ nội
 * dung — chữ "LOP-01 — HSK 1" nhìn thấy bên trong không hề trở thành tên gọi
 * được. Thiếu `<Label htmlFor>` thì axe báo `select-name` mức **critical** và
 * trình đọc màn hình chỉ đọc "combo box" trống trơn (`P17-T3`).
 */
export function ClassPicker({
  classes,
  selectedId,
  basePath = "/admin/schedule",
  placeholder = "Chọn lớp để xem lịch",
  label = "Lớp",
}: {
  classes: ClassOption[];
  selectedId?: string;
  basePath?: string;
  placeholder?: string;
  label?: string;
}) {
  const { navigate, isPending } = useNavProgress();
  // Ba trang đang dùng component này, mỗi trang một instance — `useId` giữ cho
  // `htmlFor` vẫn đúng nếu sau này có trang đặt hai bộ lọc lớp cạnh nhau.
  const triggerId = useId();

  return (
    <div className="w-full sm:w-80">
      <Label htmlFor={triggerId} className="mb-2">
        {label}
      </Label>
      <div className="relative">
        <Select
          value={selectedId ?? ""}
          disabled={isPending}
          onValueChange={(id) => navigate(`${basePath}?class=${id}`)}
        >
          <SelectTrigger id={triggerId} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.code} — {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending && (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-9 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
