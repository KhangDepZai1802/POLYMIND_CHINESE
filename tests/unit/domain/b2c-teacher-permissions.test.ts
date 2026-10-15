import { describe, it, expect } from "vitest";
import { DEFAULT_B2C_PERMISSIONS, toggleB2CPermission, teacherPermissionsSchema } from "@/features/b2c/domain/teacher-permissions";
describe("B2C teacher permissions",()=>{
 it("preserves previous read/check/pay permissions without enabling new writes",()=>{
  expect(DEFAULT_B2C_PERMISSIONS).toEqual(["view_classes","view_students","view_schedule","view_comments","check_teaching","view_pay"]);
 });
 it("adds transitive dependencies and removes dependent writes when read access is revoked",()=>{
  const granted=toggleB2CPermission([],"mark_attendance",true);
  expect(granted).toEqual(["view_classes","view_students","view_schedule","mark_attendance"]);
  expect(toggleB2CPermission([...granted,"view_pay"],"view_classes",false)).toEqual(["view_pay"]);
 });
 it("separates tuition view, collection and package edits",()=>{
  expect(toggleB2CPermission([],"collect_tuition",true)).toEqual(["view_classes","view_tuition","collect_tuition"]);
  expect(toggleB2CPermission([],"edit_tuition",true)).not.toContain("collect_tuition");
 });
 it("rejects unknown permissions, missing dependencies and missing account mapping",()=>{
  const data={teacher_id:"8b000000-0000-4000-8000-000000000005",source_teacher_id:"8b000000-0000-4000-8000-000000000004",expected_updated_at:null};
  expect(teacherPermissionsSchema.safeParse({...data,permissions:["invented"]}).success).toBe(false);
  expect(teacherPermissionsSchema.safeParse({...data,permissions:["write_comments"]}).success).toBe(false);
  expect(teacherPermissionsSchema.safeParse({...data,permissions:[],source_teacher_id:""}).success).toBe(false);
  expect(teacherPermissionsSchema.safeParse({...data,permissions:[]}).success).toBe(true);
 });
});
