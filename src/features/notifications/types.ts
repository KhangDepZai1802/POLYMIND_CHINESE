import type { Database } from "@/types/database";

export const NOTIFICATION_TYPES = [
  "session_upcoming",
  "session_changed",
  "assignment_new",
  "assignment_due",
  "assessment_upcoming",
  "result_published",
  "attendance_absent",
  "invoice_new",
  "invoice_due",
  "invoice_overdue",
  "announcement",
] as const satisfies readonly Database["public"]["Enums"]["notification_type"][];

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationItem = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "type" | "title" | "body" | "link" | "read_at" | "created_at"
>;

export type NotificationPreference = {
  type: NotificationType;
  in_app_enabled: boolean;
};
