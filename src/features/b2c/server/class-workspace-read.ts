"use server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import {
  CLASS_WORKSPACE_PATH,
  classFiltersSchema,
  type ClassStudent,
  type ClassMeeting,
  type ClassComment,
  type ClassWorkspaceResult,
} from "../domain/class-workspace";

export async function readClassWorkspaceAction(
  classId: string,
  rawFilters: Record<string, string | string[] | undefined>,
) {
  const actor = await requireManager(),
    query = rawFilters;
  if (!z.uuid().safeParse(classId).success) notFound();
  const parsed = classFiltersSchema.safeParse(query);
  if (!parsed.success) throw new Error("Bộ lọc không hợp lệ.");
  const filters = parsed.data,
    client = await createClient(),
    base = `${CLASS_WORKSPACE_PATH}/${classId}`;
  const classResult = await client
    .from("b2c_classes")
    .select(
      "id,code,name,program_slug,teacher_name,weekdays_text,time_text,capacity,enrolled_count,start_date,end_date,campus,delivery_mode,notes",
    )
    .eq("id", classId)
    .maybeSingle();
  if (classResult.error) throw new Error("Không tải được lớp B2C.");
  if (!classResult.data) notFound();
  const cls = classResult.data;
  const schedules =
    filters.tab === "schedule"
      ? await client
          .from("b2c_class_schedules")
          .select("id,weekdays,start_time,end_time,room_name,date_from,date_to")
          .eq("class_id", classId)
          .order("date_from", { ascending: false })
          .limit(100)
      : null;
  if (schedules?.error) throw new Error("Không tải được lịch lặp.");
  const { data, error } = await client.rpc("read_b2c_class_workspace", {
    p_class_id: classId,
    p_tab: filters.tab,
    p_page: filters.page,
    p_query: filters.q,
    p_meeting_id: filters.meeting,
  });
  if (error)
    throw new Error(
      "Không tải được chi tiết lớp. Kiểm tra buổi học hoặc thử tải lại.",
    );
  const result = data as unknown as ClassWorkspaceResult<
      ClassStudent | ClassMeeting | ClassComment
    >,
    meeting = result.meeting ?? null,
    today = todayISO();
  return {
    cls,
    schedules: schedules?.data ?? [],
    result,
    meeting,
    today,
    filters,
    classId,
    base,
    collector: actor.fullName,
  };
}
