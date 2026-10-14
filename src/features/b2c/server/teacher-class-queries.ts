import "server-only";

import { requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type TeacherB2CClass = {
  id: string;
  code: string;
  name: string;
  program_slug: string;
  status: string;
  capacity: number;
  weekdays_text: string | null;
  time_text: string | null;
  campus: string | null;
  start_date: string | null;
  student_count: number;
};
export type TeacherB2CRow = {
  id?: string;
  code?: string;
  full_name?: string;
  status?: string;
  enrollment_date?: string;
  starts_at?: string;
  ends_at?: string;
  teacher_name?: string;
  room_name?: string;
  content?: string;
  actor_name?: string;
  created_at?: string;
};
export type TeacherB2CMeetingToday = {
  id: string;
  class_id: string;
  code: string;
  name: string;
  starts_at: string;
  ends_at: string;
  room_name: string;
  status: string;
};
export async function getMyB2CToday() {
  await requireTeaching();
  const { data, error } = await (
    await createClient()
  ).rpc("read_my_b2c_today", {});
  if (error) throw new Error("Không tải được lịch buổi B2C hôm nay.");
  return data as unknown as {
    rows: TeacherB2CMeetingToday[];
    override_class_ids: string[];
  };
}

export async function getMyB2CClasses() {
  await requireTeaching();
  const { data, error } = await (
    await createClient()
  ).rpc("read_my_b2c_classes", {});
  if (error) throw new Error("Không tải được lớp B2C được phân công.");
  return (data as unknown as { rows: TeacherB2CClass[] }).rows;
}

export async function getMyB2CClass(
  classId: string,
  tab: string,
  page: number,
  query: string,
) {
  await requireTeaching();
  const { data, error } = await (
    await createClient()
  ).rpc("read_my_b2c_classes", {
    p_class_id: classId,
    p_tab: tab,
    p_page: page,
    p_query: query,
  });
  if (error?.code === "42501") return null;
  if (error) throw new Error("Không tải được chi tiết lớp B2C.");
  return data as unknown as {
    class: TeacherB2CClass;
    rows: TeacherB2CRow[];
    total: number;
  };
}
