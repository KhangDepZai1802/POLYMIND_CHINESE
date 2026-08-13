"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { CheckboxRow } from "./report-controls";
import type { ReportStudentEntry } from "../domain/completion";
import type { StudentCategory } from "../domain/labels";

export type RosterEntry = {
  enrollmentId: string;
  studentCode: string;
  fullName: string;
};

/** Bỏ dấu để gõ "ngoc dung" vẫn tìm ra "Ngọc Dũng". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Một nhóm học viên trong mục 5 (hoặc mục 7).
 *
 * ## Vì sao là bảng trượt có ô tìm, không phải danh sách thả xuống
 *
 * Lớp 20 người, giáo viên cần chọn 2. Bảng trượt cho hàng cao 48px — đủ ngón
 * tay trên điện thoại — giữ được nhiều lựa chọn cùng lúc, và có ô tìm để lớp
 * đông không phải cuộn. Nút chốt hiện thẳng số đã chọn.
 *
 * Mỗi học viên đã chọn có một ô nhận xét riêng: `D-43` đòi mục 5 chỉ xong khi
 * MỌI người được nhắc tên đều có nhận xét — tên trơ trọi không nói lên điều gì
 * cho bộ phận đào tạo.
 */
export function StudentCategoryField({
  category,
  label,
  noteLabel,
  roster,
  entries,
  onChange,
  disabled,
  tone,
  hint,
}: {
  category: StudentCategory;
  label: string;
  noteLabel: string;
  roster: RosterEntry[];
  entries: ReportStudentEntry[];
  onChange: (next: ReportStudentEntry[]) => void;
  disabled?: boolean;
  /** `warning` cho nhóm có hệ quả ở nơi khác (báo lên bảng giáo vụ). */
  tone?: "default" | "warning";
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = entries.filter((entry) => entry.category === category);
  const selectedIds = new Set(selected.map((entry) => entry.enrollment_id));

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return roster;
    return roster.filter(
      (person) =>
        fold(person.fullName).includes(needle) ||
        fold(person.studentCode).includes(needle),
    );
  }, [roster, query]);

  const nameOf = (enrollmentId: string) =>
    roster.find((person) => person.enrollmentId === enrollmentId)?.fullName ??
    "Học viên";

  function toggle(enrollmentId: string) {
    const others = entries.filter(
      (entry) => entry.category !== category || entry.enrollment_id !== enrollmentId,
    );
    if (selectedIds.has(enrollmentId)) {
      onChange(others);
    } else {
      onChange([...others, { category, enrollment_id: enrollmentId, note: "" }]);
    }
  }

  function setNote(enrollmentId: string, note: string) {
    onChange(
      entries.map((entry) =>
        entry.category === category && entry.enrollment_id === enrollmentId
          ? { ...entry, note }
          : entry,
      ),
    );
  }

  return (
    <div
      className={
        tone === "warning"
          ? "border-warning/40 bg-warning/5 grid gap-2 rounded-lg border p-3"
          : "grid gap-2 rounded-lg border p-3"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          {hint && (
            <p className={tone === "warning" ? "text-warning text-xs" : "text-muted-foreground text-xs"}>
              {hint}
            </p>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={disabled}>
              <Plus className="size-4" aria-hidden />
              Chọn học viên
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[85dvh] gap-0 rounded-t-2xl p-0"
          >
            <span
              className="bg-border mx-auto mt-3 h-1 w-9 shrink-0 rounded-full"
              aria-hidden
            />
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">{label}</SheetTitle>
              <SheetDescription className="sr-only">
                Chọn học viên cho nhóm {label}.
              </SheetDescription>
              <div className="relative mt-1">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã…"
                  className="pl-9"
                  aria-label="Tìm học viên"
                />
              </div>
            </SheetHeader>

            <ul className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="text-muted-foreground px-5 py-6 text-center text-sm">
                  Không có học viên nào khớp “{query}”.
                </li>
              ) : (
                filtered.map((person) => (
                  <li key={person.enrollmentId} className="border-t px-3">
                    <CheckboxRow
                      label={`${person.fullName} · ${person.studentCode}`}
                      checked={selectedIds.has(person.enrollmentId)}
                      onChange={() => toggle(person.enrollmentId)}
                    />
                  </li>
                ))
              )}
            </ul>

            <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                className="min-h-11 w-full"
                onClick={() => setOpen(false)}
              >
                {selected.length > 0
                  ? `Xong · đã chọn ${selected.length} học viên`
                  : "Xong"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {selected.length === 0 ? (
        <p className="text-muted-foreground text-xs">Chưa chọn học viên nào.</p>
      ) : (
        <ul className="grid gap-2">
          {selected.map((entry) => (
            <li key={entry.enrollment_id} className="grid gap-1">
              <div className="flex items-center gap-2">
                <span className="bg-primary-100 text-primary-700 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {nameOf(entry.enrollment_id)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  disabled={disabled}
                  aria-label={`Bỏ ${nameOf(entry.enrollment_id)} khỏi nhóm ${label}`}
                  onClick={() => toggle(entry.enrollment_id)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <Textarea
                rows={2}
                value={entry.note}
                disabled={disabled}
                maxLength={1000}
                placeholder={`${noteLabel}…`}
                aria-label={`${noteLabel} cho ${nameOf(entry.enrollment_id)}`}
                onChange={(event) => setNote(entry.enrollment_id, event.target.value)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
