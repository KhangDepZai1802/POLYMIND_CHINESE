"use client";

import { useState } from "react";
import { ChevronRight, Search, UserRoundX, Users, X } from "lucide-react";

import { StudentRowActions } from "@/features/students/components/student-row-actions";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Level = { id: string; code: string; name: string };

type StudentEnrollment = {
  id: string;
  status: string;
  class: { id: string; code: string; name: string } | null;
};

/**
 * Hình dạng hàng lấy thẳng từ `StudentRowActions` — nơi đã khai đủ những gì
 * form "Sửa hồ sơ" cần — cộng ba thứ chỉ trang danh sách mới dùng. Khai lại tay
 * là mở cửa cho hai định nghĩa trôi khác nhau (`UX-UIUX-M25-010`).
 */
type Student = React.ComponentProps<typeof StudentRowActions>["student"] & {
  status: string;
  current_level: { id: string; code: string; name: string } | null;
  enrollments: StudentEnrollment[];
};

type Group = {
  key: string;
  code: string | null;
  name: string;
  rows: Student[];
};

const UNASSIGNED = "__chua-xep-lop__";

/**
 * Bỏ dấu để gõ "duy khang" ra "Quách Duy Khang", "hv31" ra "HV000031".
 * NFD tách chữ khỏi dấu thanh rồi xoá dải `U+0300…U+036F`; `đ/Đ` phải xử riêng
 * vì NFD không tách được (cùng cách `lib/domain/files.ts` đang làm).
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Mọi thứ gõ vào ô tìm đều phải ra kết quả — kể cả tên người giám hộ và số điện
 * thoại của họ. Người trực văn phòng cầm số điện thoại phụ huynh gọi tới thì
 * thứ họ có trong tay là **số đó**, không phải mã học viên.
 */
function haystack(s: Student): string {
  return [
    s.student_code,
    s.full_name,
    s.phone,
    s.email,
    s.guardian_name,
    s.guardian_phone,
    s.profile?.username,
  ]
    .filter(Boolean)
    .join(" ");
}

function activeClassesOf(s: Student) {
  return s.enrollments.filter((e) => e.status === "active" && e.class);
}

/**
 * Danh bạ học viên.
 *
 * User báo 2026-08-03: *"học viên mà quá nhiều sẽ bị loạn"* — 55 hàng đổ thẳng
 * vào một bảng phẳng, không tìm được, không biết ai thuộc lớp nào nếu không dò
 * từng dòng cột "Lớp đang học".
 *
 * Ba việc trang này phải làm được, theo đúng thứ tự người dùng nghĩ:
 * 1. **"Lớp nào có bao nhiêu người"** → gom theo lớp, mỗi lớp một mục **thu gọn
 *    sẵn**. Mở trang là thấy cấu trúc trước, chi tiết sau.
 * 2. **"Tìm đúng một người"** → ô tìm bỏ dấu, lọc ngay khi gõ, tự mở những mục
 *    có kết quả.
 * 3. **"Ai còn thiếu gì"** → ba ô số liệu: chưa xếp lớp / chưa có tài khoản.
 *
 * ⚠️ **Lọc ở phía trình duyệt** vì cả danh sách đã nằm sẵn trong trang (55 hàng
 * hiện tại, `getStudents()` không phân trang). Gõ tới đâu thấy tới đó, không
 * round-trip. Khi số học viên lên tới hàng nghìn thì phải đổi sang lọc ở
 * `getStudents(params.search)` — hàm đó **đã** nhận tham số tìm kiếm sẵn.
 */
export function StudentsDirectory({
  students,
  levels,
  canManageAccounts,
}: {
  students: Student[];
  levels: Level[];
  canManageAccounts: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"active" | "archived">("active");
  // `null` = chưa động tới mục nào, dùng mặc định của `allOpen`.
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const [allOpen, setAllOpen] = useState(false);

  const activeStudents = students.filter((s) => s.status !== "archived");
  const archivedStudents = students.filter((s) => s.status === "archived");
  const scoped = scope === "archived" ? archivedStudents : activeStudents;

  const needle = fold(query.trim());
  const searching = needle.length > 0;
  const matched = searching
    ? scoped.filter((s) => fold(haystack(s)).includes(needle))
    : scoped;

  // Gom theo lớp. Học viên không có ghi danh `active` nào rơi vào mục cuối —
  // đó chính là nhóm cần xử lý, nên nó phải hiện ra chứ không được lặng lẽ mất.
  const byClass = new Map<string, Group>();
  const unassigned: Student[] = [];
  for (const s of matched) {
    const classes = activeClassesOf(s);
    if (classes.length === 0) {
      unassigned.push(s);
      continue;
    }
    for (const e of classes) {
      const cls = e.class!;
      const group = byClass.get(cls.id) ?? {
        key: cls.id,
        code: cls.code,
        name: cls.name,
        rows: [],
      };
      group.rows.push(s);
      byClass.set(cls.id, group);
    }
  }

  const groups: Group[] = [...byClass.values()].sort((a, b) =>
    (a.code ?? "").localeCompare(b.code ?? "", "vi"),
  );
  if (unassigned.length > 0) {
    groups.push({
      key: UNASSIGNED,
      code: null,
      name: "Chưa xếp lớp",
      rows: unassigned,
    });
  }

  const noClassCount = scoped.filter(
    (s) => activeClassesOf(s).length === 0,
  ).length;
  const noAccountCount = scoped.filter((s) => !s.user_id).length;
  // Đếm lớp trên TOÀN BỘ phạm vi, không phải trên kết quả tìm: ba ô số liệu là
  // bức tranh chung. Đo bằng số lớp đang lọc thì gõ "ngoc dung" ra "57 học
  // viên · 2 lớp" — hai con số của hai phạm vi khác nhau đứng cạnh nhau.
  const classCount = new Set(
    scoped.flatMap((s) => activeClassesOf(s).map((e) => e.class!.id)),
  ).size;

  // Đang tìm thì mở hết: giấu kết quả sau một mục thu gọn là bắt người dùng tìm
  // hai lần cho cùng một câu hỏi.
  const isOpen = (key: string) => searching || (manualOpen[key] ?? allOpen);

  const toggleGroup = (key: string) =>
    setManualOpen((prev) => ({ ...prev, [key]: !isOpen(key) }));

  const setEveryGroup = (open: boolean) => {
    setAllOpen(open);
    setManualOpen({});
  };

  const changeScope = (next: "active" | "archived") => {
    setScope(next);
    setManualOpen({});
  };

  return (
    <div className="space-y-4">
      {/* `grid-cols-3` từ 0px chứ không phải từ `sm`: xếp dọc trên điện thoại
          thì ba ô này chiếm ~340px, đẩy ô tìm kiếm và cả danh sách xuống dưới
          mép màn — người dùng mở trang ra chỉ thấy ba con số. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          label={scope === "archived" ? "Hồ sơ đã lưu trữ" : "Đang hoạt động"}
          value={scoped.length}
          hint={`${classCount} lớp`}
        />
        <StatTile
          label="Chưa xếp lớp"
          value={noClassCount}
          hint={noClassCount > 0 ? "cần ghi danh" : "tất cả đã có lớp"}
          tone={noClassCount > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Chưa có tài khoản"
          value={noAccountCount}
          hint={noAccountCount > 0 ? "chưa đăng nhập được" : "đã cấp đủ"}
          tone={noAccountCount > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* `top-16` khớp đúng chiều cao thanh đầu trang (`h-16` ở layout) — thanh
          công cụ phải dừng ngay dưới nó, chồng lên là che mất nút của lớp đầu. */}
      <Card className="bg-card/95 sticky top-16 z-20 py-3 backdrop-blur">
        <CardContent className="flex flex-wrap items-center gap-2 px-3">
          <div className="relative min-w-56 flex-1">
            <Label htmlFor="student-search" className="sr-only">
              Tìm học viên theo tên, mã, số điện thoại hoặc người giám hộ
            </Label>
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="student-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên, mã, số điện thoại…"
              className="pl-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          {archivedStudents.length > 0 && (
            <div
              role="group"
              aria-label="Lọc theo tình trạng hồ sơ"
              className="bg-muted flex shrink-0 gap-0.5 rounded-lg p-0.5"
            >
              <ScopeChip
                label="Đang hoạt động"
                count={activeStudents.length}
                active={scope === "active"}
                onClick={() => changeScope("active")}
              />
              <ScopeChip
                label="Đã lưu trữ"
                count={archivedStudents.length}
                active={scope === "archived"}
                onClick={() => changeScope("archived")}
              />
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={searching}
            title={
              searching
                ? "Đang tìm kiếm thì mọi mục có kết quả đều đã mở sẵn"
                : undefined
            }
            onClick={() => setEveryGroup(!allOpen)}
          >
            {allOpen ? "Thu gọn tất cả" : "Mở rộng tất cả"}
          </Button>
        </CardContent>
      </Card>

      {/* Trình đọc màn hình không thấy danh sách ngắn đi khi gõ — phải nói ra. */}
      <p aria-live="polite" className="sr-only">
        {searching
          ? `${matched.length} học viên khớp từ khóa ${query.trim()}.`
          : `${scoped.length} học viên.`}
      </p>

      {scoped.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title={
                scope === "archived"
                  ? "Chưa có hồ sơ nào được lưu trữ"
                  : "Chưa có học viên nào"
              }
              description={
                scope === "archived"
                  ? "Hồ sơ lưu trữ sẽ xuất hiện ở đây, dữ liệu học tập vẫn được giữ nguyên."
                  : "Tạo hồ sơ học viên. Tài khoản đăng nhập có thể cấp sau."
              }
            />
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UserRoundX}
              title={`Không có học viên nào khớp “${query.trim()}”`}
              description="Thử tìm bằng mã học viên, một phần họ tên, hoặc số điện thoại người giám hộ."
              action={
                <Button variant="outline" onClick={() => setQuery("")}>
                  Xóa từ khóa
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <ClassGroup
            key={group.key}
            group={group}
            open={isOpen(group.key)}
            onToggle={() => toggleGroup(group.key)}
            searching={searching}
            levels={levels}
            canManageAccounts={canManageAccounts}
          />
        ))
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="py-3 sm:py-4">
      <CardContent className="px-3 sm:px-4">
        <p className="text-text-secondary text-xs sm:text-sm">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-xl font-semibold tabular-nums sm:mt-1 sm:text-2xl",
            // Màu chỉ là nhấn mạnh, KHÔNG mang nghĩa riêng: "Chưa xếp lớp: 3"
            // đã nói đủ bằng chữ và số. Người mù màu không mất thông tin nào,
            // kể cả ở bề rộng đang ẩn dòng gợi ý.
            tone === "warning" && "text-warning",
          )}
        >
          {value}
        </p>
        {/* Dòng gợi ý ẩn dưới 640px — ba ô cạnh nhau ở 375px chỉ còn ~110px mỗi
            ô, thêm dòng thứ ba là chữ vỡ chứ không phải thêm thông tin. Nghĩa
            của con số vẫn nằm ở nhãn phía trên, không mất đi. */}
        <p className="text-text-secondary mt-0.5 hidden text-xs sm:block">
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

function ScopeChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // `aria-pressed` chứ không chỉ đổi màu nền: trạng thái "đang chọn" phải
      // đọc được bằng trình đọc màn hình, không chỉ bằng mắt.
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-card text-foreground shadow-xs"
          : "text-text-secondary hover:text-foreground",
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function ClassGroup({
  group,
  open,
  onToggle,
  searching,
  levels,
  canManageAccounts,
}: {
  group: Group;
  open: boolean;
  onToggle: () => void;
  searching: boolean;
  levels: Level[];
  canManageAccounts: boolean;
}) {
  const panelId = `nhom-${group.key}`;
  const isUnassigned = group.key === UNASSIGNED;
  const noAccount = group.rows.filter((s) => !s.user_id).length;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="hover:bg-row-hover focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <ChevronRight
          className={cn(
            "text-muted-foreground size-4 shrink-0 transition-transform",
            open && "rotate-90",
          )}
          aria-hidden
        />

        {group.code ? (
          <span className="bg-muted shrink-0 rounded px-2 py-0.5 font-mono text-sm font-medium">
            {group.code}
          </span>
        ) : (
          // Mục "chưa xếp lớp" cố ý mang màu cảnh báo: đây là việc còn tồn,
          // không phải một lớp học bình thường.
          <span className="bg-warning/12 text-warning border-warning/25 shrink-0 rounded border px-2 py-0.5 text-sm font-medium">
            Cần xếp lớp
          </span>
        )}

        {/* Dưới 640px con số xuống dòng thay vì đứng cùng hàng với tên lớp.
            Đo ở 375px trước khi sửa: chuỗi "25 học viên · 23 chưa có tài khoản"
            là `shrink-0` nên nó ăn hết bề rộng và **tên lớp bị cắt còn 0 ký
            tự** — hàng tiêu đề mất đúng thứ để nhận ra đó là lớp nào. */}
        <span className="min-w-0 flex-1">
          {/* `title`: ở 375px tên lớp bị cắt ("VCB — Đàm phán tài chí…"), mà đó
              đúng là thứ để phân biệt hai lớp cùng khoá. Cắt thì phải còn đường
              đọc nguyên văn. */}
          <span
            className="block truncate font-medium"
            title={isUnassigned ? undefined : group.name}
          >
            {isUnassigned ? "Chưa có lớp đang học" : group.name}
          </span>
          <span className="text-text-secondary block text-xs tabular-nums sm:hidden">
            {group.rows.length} học viên
            {noAccount > 0 && ` · ${noAccount} chưa có tài khoản`}
          </span>
        </span>

        <span className="text-text-secondary hidden shrink-0 text-sm tabular-nums sm:inline">
          {group.rows.length} học viên
          {noAccount > 0 && ` · ${noAccount} chưa có tài khoản`}
        </span>
      </button>

      {open && (
        <div id={panelId}>
          <DataTable
            caption={
              searching
                ? `Kết quả tìm kiếm trong ${isUnassigned ? "nhóm chưa xếp lớp" : `lớp ${group.code}`}: mã, họ tên, liên hệ, bậc và trạng thái tài khoản`
                : `Học viên ${isUnassigned ? "chưa xếp lớp" : `lớp ${group.code} — ${group.name}`}: mã, họ tên, liên hệ, bậc và trạng thái tài khoản`
            }
            minWidthClass="min-w-[48rem]"
          >
            <DataTableHeader>
              <tr>
                <DataTableHead sticky>Mã</DataTableHead>
                <DataTableHead>Họ tên</DataTableHead>
                <DataTableHead>Liên hệ</DataTableHead>
                <DataTableHead>Bậc hiện tại</DataTableHead>
                <DataTableHead>Tài khoản</DataTableHead>
                <DataTableHead className="w-10">
                  <span className="sr-only">Thao tác</span>
                </DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {group.rows.map((s) => (
                <DataTableRow key={s.id}>
                  <DataTableCell
                    sticky
                    className="font-mono text-sm font-medium"
                  >
                    {s.student_code}
                  </DataTableCell>
                  <DataTableCell>
                    <p className="font-medium">{s.full_name}</p>
                    {s.guardian_name && (
                      <p className="text-text-secondary text-sm">
                        GH: {s.guardian_name}
                        {s.guardian_phone && ` · ${s.guardian_phone}`}
                      </p>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <p>{s.phone ?? "—"}</p>
                    {s.email && (
                      <p className="text-text-secondary text-sm">{s.email}</p>
                    )}
                  </DataTableCell>
                  <DataTableCell>{s.current_level?.name ?? "—"}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      label={s.user_id ? "Đã cấp" : "Chưa cấp"}
                      tone={s.user_id ? "success" : "neutral"}
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <StudentRowActions
                      student={s}
                      levels={levels}
                      canManageAccounts={canManageAccounts}
                    />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>

          {/* Học viên đang học nhiều hơn một lớp thì xuất hiện ở nhiều mục —
              nói ra chứ không để người đọc tự đếm rồi tưởng dữ liệu sai. */}
          {!isUnassigned &&
            group.rows.some((s) => activeClassesOf(s).length > 1) && (
              <p className="text-text-secondary border-t px-4 py-2 text-xs">
                Một số học viên trong mục này còn học lớp khác nên cũng xuất
                hiện ở mục của lớp đó.
              </p>
            )}
        </div>
      )}
    </Card>
  );
}
