import { z } from "zod";
export const PIPELINE_PATH = "/workspace/xkld/pipeline";
export const PIPELINE_STAGES = {
  lead: "Lead",
  consultation: "Tư vấn",
  registration: "Đăng ký/đặt cọc",
  language_training: "Đào tạo ngoại ngữ",
  documentation: "Hoàn thiện hồ sơ",
  interview: "Phỏng vấn",
  selected: "Trúng tuyển",
  visa: "Visa/giấy phép",
  departed: "Xuất cảnh",
  aftercare: "Hậu xuất cảnh",
} as const;
export const STAGE_CODES = [
  "lead",
  "consultation",
  "registration",
  "language_training",
  "documentation",
  "interview",
  "selected",
  "visa",
  "departed",
  "aftercare",
] as const;
export type PipelineStage = (typeof STAGE_CODES)[number];
export type PipelineCard = {
  id: string;
  code: string;
  full_name: string;
  phone: string;
  stage: PipelineStage;
  assignee_id: string;
  assignee_name: string | null;
  updated_at: string;
  order_id: string | null;
  order_code: string | null;
  order_employer: string | null;
  b2c_class_id: string | null;
  class_label: string | null;
};
export type PipelineGroup = {
  stage: PipelineStage;
  total: number;
  candidates: PipelineCard[];
};
export type LinkedClass = {
  id: string;
  code: string;
  name: string;
  program_slug: string;
  status: string;
};
export type LinkedOrder = {
  id: string;
  code: string;
  employer: string;
  country_name: string;
};
export type SearchPage<T> = { rows: T[]; total: number };
export type ProgressEvent = {
  id: string;
  created_at: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  old_order_code: string | null;
  new_order_code: string | null;
  old_class_label: string | null;
  new_class_label: string | null;
  actor_id: string | null;
  actor_name: string | null;
  note: string;
};
const optionalUuid = z
  .union([z.literal(""), z.uuid()])
  .transform((v) => v || null);
export const transitionSchema = z
  .object({
    candidate_id: z.uuid(),
    stage: z.enum(STAGE_CODES),
    order_id: optionalUuid,
    b2c_class_id: optionalUuid,
    expected_updated_at: z.iso.datetime({ offset: true }),
    request_id: z.uuid(),
    note: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    const position = STAGE_CODES.indexOf(v.stage);
    if (position >= 3 && !v.b2c_class_id)
      ctx.addIssue({
        code: "custom",
        path: ["b2c_class_id"],
        message: "Vui lòng liên kết lớp B2C ở bước đào tạo ngoại ngữ",
      });
    if (position >= 5 && !v.order_id)
      ctx.addIssue({
        code: "custom",
        path: ["order_id"],
        message: "Vui lòng gắn đơn hàng trước bước phỏng vấn",
      });
  });
export const pipelineFiltersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  assignee: z.union([z.literal(""), z.uuid()]).default(""),
  stage: z.enum(["", ...STAGE_CODES]).default(""),
  page: z.coerce.number().int().min(0).max(1000000).default(0),
});
export type PipelineFilters = z.infer<typeof pipelineFiltersSchema>;
export function allowedPipelineStage(
  from: PipelineStage,
  to: PipelineStage,
  note: string,
) {
  const old = STAGE_CODES.indexOf(from),
    next = STAGE_CODES.indexOf(to);
  return next <= old + 1 && (next >= old || !!note.trim());
}
