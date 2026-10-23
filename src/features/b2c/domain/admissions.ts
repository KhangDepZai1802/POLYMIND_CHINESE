export const ADMISSION_STAGES = ["lead", "consulted", "trial", "deposit", "enrolled", "lost"] as const;
export const ADMISSION_STAGE_LABELS: Record<string, string> = {
  lead: "Lead", consulted: "Đã tư vấn", trial: "Học thử", deposit: "Đặt cọc", enrolled: "Ghi danh", lost: "Thất bại",
};
export type AdmissionLead = {
  id: string; full_name: string; phone: string | null; program_slug: string;
  stage: string; customer_source: string | null; referrer_name: string | null;
  salesperson: string; notes: string | null; failure_reason: string | null;
  amis_order_sales?: number | null; amis_last_purchase_date?: string | null;
  amis_days_since_purchase?: number | null;
  nextFollowupDate?: string | null;
};
