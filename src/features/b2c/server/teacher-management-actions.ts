"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTeaching } from "@/lib/auth/session";
import { permissionRpc } from "./permission-rpc";
import { classFiltersSchema } from "../domain/class-workspace";
import type { readClassWorkspaceAction } from "./class-workspace-read";
import { todayISO } from "@/lib/dates";
import { B2C_STUDENT_STATUSES } from "../domain/student-status";
export type TeacherClassEdit = {
  id?: string;
  name: string;
  program_slug: string;
  capacity: number;
  campus: string | null;
  delivery_mode: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  updated_at: string | null;
};
export type TeacherStudentEdit = {
  full_name: string;
  phone: string | null;
  status: string;
  withdrawal_reason: string | null;
  enrollment_date: string | null;
  updated_at: string;
  student_updated_at: string;
  can_edit_profile: boolean;
};
export async function readTeacherWorkspaceAction(
  classId: string,
  input: Record<string, string | string[] | undefined>,
) {
  const actor = await requireTeaching();
  const id = z.uuid().parse(classId),
    filters = classFiltersSchema.parse(input);
  type Model = Awaited<ReturnType<typeof readClassWorkspaceAction>>;
  const result = await permissionRpc<
    Model["result"] & { class: Model["cls"]; schedules: Model["schedules"] }
  >("read_teacher_b2c_workspace", {
    p_class_id: id,
    p_tab: filters.tab,
    p_page: filters.page,
    p_query: filters.q,
    p_meeting_id: filters.meeting,
  });
  return {
    cls: result.class,
    schedules: result.schedules,
    result,
    meeting: result.meeting ?? null,
    today: todayISO(),
    filters,
    classId: id,
    base: `/teacher/b2c-classes/${id}`,
    collector: actor.fullName,
  } satisfies Model;
}
export async function readTeacherClassEditAction(id: string) {
  await requireTeaching("super_admin");
  return permissionRpc<TeacherClassEdit>("read_teacher_b2c_class_edit", {
    p_id: z.uuid().parse(id),
  });
}
export async function readTeacherStudentEditAction(
  classId: string,
  enrollmentId: string,
) {
  await requireTeaching();
  return permissionRpc<TeacherStudentEdit | null>(
    "read_teacher_b2c_student_edit",
    {
      p_class_id: z.uuid().parse(classId),
      p_enrollment_id: z.uuid().parse(enrollmentId),
    },
  );
}
const classSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    program_slug: z.enum([
      "tieng-anh",
      "tieng-trung",
      "tieng-viet",
      "lop-ve",
      "kem-1-1",
    ]),
    capacity: z.coerce.number().int().positive(),
    campus: z.string().max(200),
    delivery_mode: z.enum(["offline", "online", "hybrid"]),
    start_date: z.union([z.literal(""), z.iso.date()]),
    end_date: z.union([z.literal(""), z.iso.date()]).default(""),
    status: z.enum(["planned", "active", "paused", "completed", "cancelled"]),
    notes: z.string().max(4000),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "Ngày kết thúc khóa học không được trước ngày khai giảng.",
  });
export async function saveTeacherClassAction(input: unknown) {
  await requireTeaching("super_admin");
  const parsed = z
    .object({
      id: z.uuid().nullable(),
      request_id: z.uuid(),
      expected_updated_at: z.string().nullable(),
      data: classSchema,
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Kiểm tra thông tin lớp.",
    };
  try {
    const v = parsed.data;
    await permissionRpc("save_teacher_b2c_class", {
      p_id: v.id,
      p_request_id: v.request_id,
      p_data: v.data,
      p_expected_updated_at: v.expected_updated_at,
    });
    revalidatePath("/teacher", "layout");
    revalidatePath("/admin/b2c", "layout");
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không lưu được lớp." };
  }
}
export async function saveTeacherStudentAction(
  classId: string,
  enrollmentId: string,
  input: unknown,
) {
  await requireTeaching();
  const parsed = z
    .object({
      full_name: z.string().trim().min(1).max(200),
      phone: z.union([z.literal(""), z.string().regex(/^[0-9]{10}$/)]),
      status: z.enum(B2C_STUDENT_STATUSES),
      withdrawal_reason: z.string().max(1000),
      enrollment_date: z.union([z.literal(""), z.iso.date()]),
      updated_at: z.string(),
      student_updated_at: z.string(),
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      error: "Kiểm tra tên, số điện thoại, ngày nhập học và trạng thái.",
    };
  try {
    await permissionRpc("save_teacher_b2c_student", {
      p_class_id: z.uuid().parse(classId),
      p_enrollment_id: z.uuid().parse(enrollmentId),
      p_data: parsed.data,
    });
    revalidatePath("/teacher", "layout");
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Không lưu được học viên.",
    };
  }
}
