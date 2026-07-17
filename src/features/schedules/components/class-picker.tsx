"use client";

import { Loader2 } from "lucide-react";

import { useNavProgress } from "@/components/shared/use-nav-progress";
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
  basePath = "/admin/schedule",
  placeholder = "Chọn lớp để xem lịch",
}: {
  classes: ClassOption[];
  selectedId?: string;
  basePath?: string;
  placeholder?: string;
}) {
  const { navigate, isPending } = useNavProgress();

  return (
    <div className="relative w-full sm:w-80">
      <Select
        value={selectedId ?? ""}
        disabled={isPending}
        onValueChange={(id) => navigate(`${basePath}?class=${id}`)}
      >
        <SelectTrigger className="w-full">
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
  );
}
