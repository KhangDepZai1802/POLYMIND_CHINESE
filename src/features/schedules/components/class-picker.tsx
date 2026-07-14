"use client";

import { useRouter } from "next/navigation";

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
 */
export function ClassPicker({
  classes,
  selectedId,
}: {
  classes: ClassOption[];
  selectedId?: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={selectedId ?? ""}
      onValueChange={(id) => router.push(`/admin/schedule?class=${id}`)}
    >
      <SelectTrigger className="w-full sm:w-80">
        <SelectValue placeholder="Chọn lớp để xem lịch" />
      </SelectTrigger>
      <SelectContent>
        {classes.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.code} — {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
