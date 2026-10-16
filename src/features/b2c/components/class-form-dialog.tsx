"use client";

import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";

import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createB2CClassAction } from "@/features/b2c/server/actions";
import { useFormAction } from "@/lib/use-form-action";

export function B2CClassFormDialog({
  programSlug,
  programTitle,
}: {
  programSlug: string;
  programTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const { state, formAction } = useFormAction(createB2CClassAction, {
    onSuccess: () => setOpen(false),
  });
  const errors = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          Thêm lớp mới
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thêm lớp {programTitle}</DialogTitle>
          <DialogDescription>
            Dữ liệu được lưu riêng trong khu vực B2C, không ghi vào các lớp
            doanh nghiệp VCB.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="program_slug" value={programSlug} />
          <input
            type="hidden"
            name="weekdays_text"
            value={weekdays.join("-")}
          />
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <section
            className="space-y-4 rounded-lg border p-4"
            aria-labelledby="b2c-class-information"
          >
            <div>
              <h3 id="b2c-class-information" className="font-medium">
                Thông tin lớp
              </h3>
              <p className="text-muted-foreground text-xs">
                Các trường tương ứng với cột B–F trong file danh sách học viên.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ngày khai giảng khóa học"
                name="start_date"
                type="date"
                error={errors.start_date}
              />
              <Field label="Ngày kết thúc khóa học" name="end_date" type="date" error={errors.end_date} />
              <Field
                label="Tên lớp *"
                name="name"
                list="b2c-class-suggestions"
                error={errors.name}
                placeholder="Ví dụ: Let's Move Up"
                required
              />
              <Field
                label="Giáo viên"
                name="teacher_name"
                list="b2c-teacher-suggestions"
                error={errors.teacher_name}
                placeholder="Ví dụ: Cô Tú"
              />
              <Field
                label="Cấp độ"
                name="level_name"
                error={errors.level_name}
                placeholder="Ví dụ: Movers / HSK 2 / Cơ bản"
              />
            </div>
            <datalist id="b2c-class-suggestions">
              {classSuggestions(programSlug).map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="b2c-teacher-suggestions">
              {[
                "Cô Tú",
                "Cô Lê",
                "Cô Uyên",
                "Cô Vân",
                "Cô Ngọc",
                "Cô Hiền",
                "Cô My",
                "Thầy Thiện",
              ].map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <div className="space-y-2">
              <Label>Ngày học</Label>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => {
                  const selected = weekdays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      size="sm"
                      aria-pressed={selected}
                      onClick={() =>
                        setWeekdays((current) =>
                          selected
                            ? current.filter((item) => item !== day)
                            : [...current, day],
                        )
                      }
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs">
                Có thể chọn nhiều ngày giống cột “Ngày học” trong Excel.
              </p>
            </div>
            <Field
              label="Giờ học"
              name="time_text"
              error={errors.time_text}
              placeholder="Ví dụ: 18h00 - 19h30"
            />
          </section>

          <section
            className="space-y-4 rounded-lg border p-4"
            aria-labelledby="b2c-extra-information"
          >
            <div>
              <h3 id="b2c-extra-information" className="font-medium">
                Thông tin quản lý bổ sung
              </h3>
              <p className="text-muted-foreground text-xs">
                Dùng để lọc và theo dõi lớp trên hệ thống.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Cơ sở"
                name="campus"
                error={errors.campus}
                placeholder="Cơ sở Tân Tạo"
              />
              <Field
                label="Sĩ số tối đa *"
                name="capacity"
                type="number"
                defaultValue="15"
                min="1"
                error={errors.capacity}
                required
              />
              <Field
                label="Số học viên hiện tại *"
                name="enrolled_count"
                type="number"
                defaultValue="0"
                min="0"
                error={errors.enrolled_count}
                required
              />
              <SelectField
                label="Hình thức"
                name="delivery_mode"
                options={[
                  ["offline", "Trực tiếp"],
                  ["online", "Trực tuyến"],
                  ["hybrid", "Kết hợp"],
                ]}
              />
              <SelectField
                label="Trạng thái"
                name="status"
                options={[
                  ["planned", "Sắp khai giảng"],
                  ["active", "Đang học"],
                  ["paused", "Tạm dừng"],
                  ["completed", "Đã hoàn thành"],
                  ["cancelled", "Đã hủy"],
                ]}
              />
            </div>
          </section>
          <div className="space-y-2">
            <Label htmlFor="b2c-notes">Ghi chú</Label>
            <Textarea id="b2c-notes" name="notes" rows={3} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Tạo lớp</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function classSuggestions(programSlug: string) {
  const suggestions: Record<string, string[]> = {
    "tieng-anh": [
      "Let's Move Up",
      "Pre-Movers",
      "Starter Hero",
      "Step Up",
      "Teen 1",
      "Teen 3",
    ],
    "tieng-trung": [
      "HSK 2-KID4",
      "HSK 4-K13",
      "HSK4-KID3",
      "HSK-K16",
      "HSK-K17",
      "YCT1-K6",
      "YCT3-K4",
    ],
    "tieng-viet": [],
    "lop-ve": ["Lớp vẽ cơ bản"],
    "kem-1-1": ["Kèm 1-1"],
  };
  return suggestions[programSlug] ?? [];
}

function Field({
  label,
  name,
  error,
  ...props
}: { label: string; name: string; error?: string } & React.ComponentProps<
  typeof Input
>) {
  const id = `b2c-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: [string, string][];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`b2c-${name}`}>{label}</Label>
      <select
        id={`b2c-${name}`}
        name={name}
        className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
