"use client";

import { AlertCircle, UserPlus, UserRoundX } from "lucide-react";

import {
  assignTeacherAction,
  removeTeacherAssignmentAction,
} from "@/features/classes/server/actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormAction } from "@/lib/use-form-action";

type TeacherOption = {
  id: string;
  teacher_code: string;
  profile: { full_name: string } | null;
};

type Assignment = {
  id: string;
  teacher_id: string;
  teacher: {
    id: string;
    teacher_code: string;
    specialization: string | null;
    profile: {
      full_name: string;
      phone: string | null;
      email: string | null;
    } | null;
  } | null;
};

export function TeacherAssignments({
  classId,
  assignment,
  teachers,
}: {
  classId: string;
  assignment: Assignment | null;
  teachers: TeacherOption[];
}) {
  const { state, formAction } = useFormAction(assignTeacherAction);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Đội ngũ giảng dạy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!assignment ? (
          <div className="bg-muted/40 rounded-lg border border-dashed p-4 text-sm">
            <p className="font-medium">Chưa phân công giáo viên</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Lớp phải có một giáo viên phụ trách trước khi chuyển sang Đang
              học.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            <li className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {assignment.teacher?.profile?.full_name ?? "Giáo viên"}
                  </p>
                  <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                    Giáo viên phụ trách
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {assignment.teacher?.teacher_code ?? "—"}
                  {assignment.teacher?.specialization
                    ? ` · ${assignment.teacher.specialization}`
                    : ""}
                </p>
              </div>
              <RemoveAssignmentButton
                id={assignment.id}
                classId={classId}
                teacherName={
                  assignment.teacher?.profile?.full_name ?? "giáo viên"
                }
              />
            </li>
          </ul>
        )}

        <form action={formAction} className="space-y-3 rounded-lg border p-4">
          <input type="hidden" name="class_id" value={classId} />
          <div className="flex items-center gap-2">
            <UserPlus className="text-muted-foreground size-4" aria-hidden />
            <p className="text-sm font-medium">
              {assignment ? "Đổi giáo viên phụ trách" : "Phân công giáo viên"}
            </p>
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="teacher_id">Giáo viên</Label>
              <Select name="teacher_id" required>
                <SelectTrigger id="teacher_id" className="w-full">
                  <SelectValue placeholder="Chọn giáo viên" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.teacher_code} —{" "}
                      {teacher.profile?.full_name ?? "Chưa có tên"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SubmitButton className="w-full sm:w-auto">
              {assignment ? "Đổi giáo viên" : "Phân công"}
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RemoveAssignmentButton({
  id,
  classId,
  teacherName,
}: {
  id: string;
  classId: string;
  teacherName: string;
}) {
  const { formAction } = useFormAction(removeTeacherAssignmentAction, {
    toastError: true,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="class_id" value={classId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`Gỡ phân công ${teacherName}`}
        title={`Gỡ phân công ${teacherName}`}
      >
        <UserRoundX className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}
