"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addB2CClassStudentAction,
  findB2CEnrollmentStudentsAction,
} from "../server/enrollment-actions";
import { B2C_CUSTOMER_SOURCE_LABELS } from "../domain/customer-source";
import { B2C_LEARNING_GOAL_LABELS } from "../domain/learning-goal";
import type { EnrollmentStudentOption } from "../enrollment-create-schema";
import { useClassWorkspaceRefresh } from "./class-workspace-refresh";
const selectClass =
  "border-input bg-background min-h-11 w-full rounded-md border px-3 text-sm";

export function ClassStudentAddDialog({
  classId: fixedClassId,
  className: fixedClassName,
  classes = [],
  today,
  onAdded,
}: {
  classId?: string;
  className?: string;
  classes?: { id: string; code: string; name: string; status: string }[];
  today: string;
  onAdded?: () => void;
}) {
  const router = useRouter(),
    refresh = useClassWorkspaceRefresh(),
    sequence = useRef(0);
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("new"),
    [request, setRequest] = useState("");
  const [chosenClassId, setChosenClassId] = useState("");
  const classId = fixedClassId ?? chosenClassId;
  const className =
    fixedClassName ??
    classes.find((c) => c.id === classId)?.name ??
    "Chọn lớp để ghi danh";
  const availableClasses = classes.filter(
    (c) => !["completed", "cancelled"].includes(c.status),
  );
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [source, setSource] = useState(""),
    [goal, setGoal] = useState("");
  const [query, setQuery] = useState(""),
    [rows, setRows] = useState<EnrollmentStudentOption[]>([]),
    [selected, setSelected] = useState("");
  const [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [searchError, setSearchError] = useState("");
  async function search(value: string, next = 0, targetClassId = classId) {
    if (!targetClassId) return;
    const token = ++sequence.current;
    setLoading(true);
    setSearchError("");
    setRows([]);
    setSelected("");
    try {
      const result = await findB2CEnrollmentStudentsAction(
        targetClassId,
        value,
        next,
      );
      if (token !== sequence.current) return;
      setRows(result.rows);
      setTotal(result.total);
      setPage(next);
    } catch (e) {
      if (token === sequence.current)
        setSearchError(
          e instanceof Error ? e.message : "Không tìm được học viên.",
        );
    } finally {
      if (token === sequence.current) setLoading(false);
    }
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    required = false,
    maxLength = 200,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`${name}-${classId}`}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      <Input
        id={`${name}-${classId}`}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        {...(type === "date" && name === "date_of_birth"
          ? { min: "1900-01-01", max: today }
          : {})}
      />
    </div>
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (saving) return;
        setOpen(value);
        sequence.current++;
        if (value) {
          setChosenClassId("");
          setMode("new");
          setRequest(crypto.randomUUID());
          setError("");
          setSource("");
          setGoal("");
          setQuery("");
          setRows([]);
          setSelected("");
          setLoading(false);
          setSearchError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" aria-hidden />
          Thêm học viên
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm học viên vào lớp</DialogTitle>
          <DialogDescription>
            {className} · Tạo hồ sơ mới hoặc chọn học viên đã có. Gói học phí
            được lập tại mục Học phí sau khi ghi danh.
          </DialogDescription>
        </DialogHeader>
        <form
          key={request}
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (saving || !classId) return;
            const values = new FormData(event.currentTarget);
            values.set("request_id", request);
            values.set("class_id", classId);
            values.set("mode", mode);
            values.set("student_id", mode === "existing" ? selected : "");
            setSaving(true);
            setError("");
            try {
              const result = await addB2CClassStudentAction(values);
              if (result.error) setError(result.error);
              else {
                toast.success(result.success);
                setOpen(false);
                sequence.current++;
                router.refresh();
                refresh();
                onAdded?.();
              }
            } catch {
              setError(
                "Chưa xác nhận được kết quả. Giữ nguyên nội dung và thử lại.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <fieldset disabled={saving} className="space-y-4">
            {!fixedClassId && (
              <div className="space-y-2">
                <Label htmlFor="enrollment-class">
                  Lớp ghi danh <span className="text-red-500">*</span>
                </Label>
                <select
                  id="enrollment-class"
                  className={selectClass}
                  value={chosenClassId}
                  required
                  onChange={(e) => {
                    const nextClass = e.target.value;
                    setChosenClassId(nextClass);
                    sequence.current++;
                    setSelected("");
                    setRows([]);
                    setTotal(0);
                    setPage(0);
                    setSearchError("");
                    setLoading(false);
                    if (mode === "existing" && nextClass)
                      void search(query, 0, nextClass);
                  }}
                >
                  <option value="">Chọn lớp</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
                {!availableClasses.length && (
                  <p className="text-muted-foreground text-sm">
                    Chưa có lớp nhận ghi danh. Hãy tạo lớp trước.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`mode-${classId}`}>Cách thêm học viên</Label>
              <select
                id={`mode-${classId}`}
                className={selectClass}
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setSelected("");
                  sequence.current++;
                  setLoading(false);
                  if (e.target.value === "existing") void search(query);
                }}
              >
                <option value="new">Tạo học viên mới</option>
                <option value="existing">Chọn học viên đã có</option>
              </select>
            </div>
            {mode === "new" ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Nếu học viên từng học tại trung tâm, chọn “Học viên đã có” để
                  giữ cùng một hồ sơ và mã học viên.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("full_name", "Họ tên học viên", "text", true)}
                  {field("date_of_birth", "Ngày sinh", "date")}
                  {field("guardian_name", "Họ tên phụ huynh")}
                  {field(
                    "guardian_zalo",
                    "Số Zalo phụ huynh",
                    "tel",
                    false,
                    10,
                  )}
                  {field("phone", "SĐT liên hệ", "tel", false, 10)}
                  {field("email", "Email liên hệ", "email")}
                  {field("address", "Địa chỉ", "text", false, 1000)}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`source-${classId}`}>Nguồn khách</Label>
                  <select
                    id={`source-${classId}`}
                    name="customer_source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Chưa xác định</option>
                    {Object.entries(B2C_CUSTOMER_SOURCE_LABELS).map(
                      ([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                {source === "referral" &&
                  field("referrer_name", "Người giới thiệu", "text", true)}
              </>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <Label htmlFor={`find-${classId}`}>
                  Tìm theo mã, tên, SĐT hoặc phụ huynh
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`find-${classId}`}
                    value={query}
                    maxLength={200}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void search(query);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading || !classId}
                    onClick={() => void search(query)}
                  >
                    Tìm học viên
                  </Button>
                </div>
                {loading ? (
                  <p role="status">Đang tìm…</p>
                ) : searchError ? (
                  <div role="alert">
                    <p>{searchError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void search(query)}
                    >
                      Thử tìm lại
                    </Button>
                  </div>
                ) : (
                  <>
                    {rows.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        Không có học viên phù hợp hoặc học viên đã có trong lớp.
                      </p>
                    )}
                    {rows.map((s) => (
                      <label
                        key={s.id}
                        className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                      >
                        <input
                          type="radio"
                          name="selected_student"
                          value={s.id}
                          checked={selected === s.id}
                          onChange={() => setSelected(s.id)}
                        />
                        <span>
                          <strong>
                            {s.code} · {s.full_name}
                          </strong>
                          <span className="text-muted-foreground block text-xs">
                            {[
                              s.date_of_birth
                                ? `Ngày sinh ${s.date_of_birth}`
                                : "",
                              s.guardian_name,
                              s.phone,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </label>
                    ))}
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={page === 0}
                        onClick={() => void search(query, page - 1)}
                      >
                        Trước
                      </Button>
                      <span className="text-xs">
                        Trang {page + 1} · {total} học viên
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={(page + 1) * 20 >= total}
                        onClick={() => void search(query, page + 1)}
                      >
                        Sau
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`enrollment_date-${classId}`}>
                  Ngày nhập học <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`enrollment_date-${classId}`}
                  name="enrollment_date"
                  type="date"
                  required
                  defaultValue={today}
                />
              </div>
              {field("salesperson", "Người chốt", "text", true)}
              {field("learning_start_date", "Ngày bắt đầu học", "date")}
              {field("tuition_end_date", "Ngày hết học phí", "date")}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`goal-${classId}`}>Mục tiêu học</Label>
              <select
                id={`goal-${classId}`}
                name="learning_goal"
                className={selectClass}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                <option value="">Chưa xác định</option>
                {Object.entries(B2C_LEARNING_GOAL_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {goal === "certificate" &&
              field("certificate_goal", "Chứng chỉ mục tiêu", "text", true)}
            {field("notes", "Ghi chú ghi danh", "text", false, 2000)}
            <Button
              type="submit"
              disabled={
                saving ||
                !classId ||
                (mode === "existing" && (!selected || loading))
              }
            >
              {saving ? "Đang thêm…" : "Lưu học viên vào lớp"}
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
