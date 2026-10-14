import { z } from "zod";
import type { UserRole } from "@/types/roles";

export const XKLD_READ_ROLES = ["super_admin", "executive", "xkld_staff"] as const;
export const XKLD_EDIT_ROLES = ["super_admin", "xkld_staff"] as const;
export function canReadXkld(role: UserRole) { return (XKLD_READ_ROLES as readonly UserRole[]).includes(role); }
export function canEditXkld(role: UserRole) { return (XKLD_EDIT_ROLES as readonly UserRole[]).includes(role); }
export const CANDIDATE_SOURCES = { collaborator: "CTV", employee: "Nhân viên", advertising: "Quảng cáo" } as const;
export const HEALTH_STATUSES = { passed: "Đạt", failed: "Không đạt" } as const;
export const CANDIDATES_PATH = "/workspace/xkld/candidates";
export type Assignee = { id: string; full_name: string; is_active: boolean };
export type Candidate = {
  id: string; code: string; full_name: string; date_of_birth: string; phone: string;
  zalo: string | null; hometown: string; education: string; occupation: string;
  health_status: keyof typeof HEALTH_STATUSES; source: keyof typeof CANDIDATE_SOURCES;
  assignee_id: string; created_at: string; updated_at: string;
};
const text = (max: number) => z.string().trim().min(1, "Vui lòng nhập thông tin").max(max);
export const candidateSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]),
  create_request_id: z.uuid(),
  updated_at: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
  full_name: text(200),
  date_of_birth: z.iso.date("Ngày sinh không hợp lệ").refine(value => value >= "1900-01-01" && value <= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), "Ngày sinh không hợp lệ hoặc ở tương lai"),
  phone: z.string().trim().regex(/^(0\d{9}|\+84\d{9})$/, "Nhập SĐT 10 số hoặc định dạng +84"),
  zalo: z.string().trim().max(200).transform(value => value || null),
  hometown: text(300), education: text(200), occupation: text(200),
  health_status: z.enum(["passed", "failed"], { error: "Vui lòng chọn sức khỏe" }),
  source: z.enum(["collaborator", "employee", "advertising"], { error: "Vui lòng chọn nguồn" }),
  assignee_id: z.uuid("Vui lòng chọn người phụ trách"),
}).refine(value => !value.id || !!value.updated_at, { path: ["updated_at"], message: "Thiếu phiên bản hồ sơ, vui lòng tải lại trang" });

export const candidateFiltersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  source: z.enum(["", "collaborator", "employee", "advertising"]).default(""),
  health: z.enum(["", "passed", "failed"]).default(""),
  assignee: z.union([z.literal(""), z.uuid()]).default(""),
  page: z.coerce.number().int().min(0).max(1000000).default(0),
});
export type CandidateFilters = z.infer<typeof candidateFiltersSchema>;
