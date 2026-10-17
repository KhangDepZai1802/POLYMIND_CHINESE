import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ParentRow } from "../domain/parents";
import type { ParentDashboardRow } from "../domain/parent-dashboard";
export async function readParentDashboard(): Promise<ParentDashboardRow[]> {
  await requireManager();
  const client = await createClient(), parents: ParentRow[] = [];
  let expected: number | null = null;
  for (let page = 0; ; page++) {
    const { data, error } = await client.rpc("get_b2c_parents_page", { p_query: "", p_page: page });
    if (error) throw new Error("Không tải được danh sách phụ huynh.");
    const result = data as unknown as { parents: ParentRow[]; total: number };
    if (!result || !Array.isArray(result.parents) || !Number.isInteger(result.total)) throw new Error("Dữ liệu phụ huynh chưa hợp lệ.");
    if (expected !== null && result.total !== expected) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
    expected = result.total; parents.push(...result.parents);
    if (parents.length >= result.total) break;
    if (!result.parents.length) throw new Error("Chưa tải đủ hồ sơ phụ huynh.");
  }
  if (new Set(parents.map(p => p.id)).size !== parents.length) throw new Error("Danh sách vừa thay đổi. Vui lòng tải lại.");
  const codes = Array.from(new Set(parents.flatMap(p => p.children.map(c => c.code))));
  const students = new Map<string, string>(), studentClasses = new Map<string, Set<string>>(), classNames = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 200) {
    const { data, error } = await client.from("b2c_students").select("id,code").in("code", codes.slice(i, i + 200));
    if (error) throw new Error("Không tải được học viên liên kết.");
    for (const student of data ?? []) students.set(student.code, student.id);
  }
  const ids = Array.from(students.values()), classIds = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("b2c_enrollments").select("id,student_id,class_id").in("student_id", ids.slice(i, i + 200)).in("status", ["studying", "on_hold", "awaiting_renewal", "overdue"]).order("id").range(offset, offset + 499);
      if (error) throw new Error("Không tải được lớp của các con.");
      for (const e of data ?? []) { const list = studentClasses.get(e.student_id) ?? new Set<string>(); list.add(e.class_id); studentClasses.set(e.student_id, list); classIds.add(e.class_id); }
      if (!data || data.length < 500) break;
    }
  }
  const allClassIds = Array.from(classIds);
  for (let i = 0; i < allClassIds.length; i += 200) {
    const { data, error } = await client.from("b2c_classes").select("id,name").in("id", allClassIds.slice(i, i + 200));
    if (error) throw new Error("Không tải được tên lớp.");
    for (const c of data ?? []) classNames.set(c.id, c.name);
  }
  return parents.map(p => ({ ...p, children: p.children.map(c => ({ ...c, classes: Array.from(studentClasses.get(students.get(c.code) ?? "") ?? []).map(id => ({ id, name: classNames.get(id) ?? "Lớp chưa cập nhật tên" })) })) }));
}
