import { z } from "zod";
export const ORDERS_PATH = "/workspace/xkld/orders";
export const ORDER_STATUSES = {
  open: "Đang tuyển",
  paused: "Tạm dừng",
  closed: "Đã đóng",
} as const;
export const SALARY_PERIODS = {
  hour: "Giờ",
  day: "Ngày",
  month: "Tháng",
  year: "Năm",
} as const;
export type Market = {
  id: string;
  country_code: string;
  country_name: string;
  currency_code: string;
  is_active: boolean;
  updated_at: string;
};
export type RecruitmentOrder = {
  id: string;
  code: string;
  market_id: string;
  employer: string;
  industry: string;
  recruitment_quantity: number;
  salary_amount: number;
  salary_currency: string;
  salary_period: keyof typeof SALARY_PERIODS;
  conditions: string;
  recruitment_deadline: string;
  partner: string;
  status: keyof typeof ORDER_STATUSES;
  created_at: string;
  updated_at: string;
};
const text = (max: number) =>
  z.string().trim().min(1, "Vui lòng nhập thông tin").max(max);
const version = {
  id: z.union([z.literal(""), z.uuid()]),
  create_request_id: z.uuid(),
  updated_at: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
};
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Mã tiền tệ gồm 3 chữ, ví dụ SGD, JPY, TWD");
const hasVersion = (v: { id: string; updated_at: string }) =>
  !v.id || !!v.updated_at;
const versionMessage = {
  path: ["updated_at"],
  message: "Thiếu phiên bản dữ liệu. Vui lòng tải lại trang.",
};
export const marketSchema = z
  .object({
    ...version,
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Mã quốc gia gồm 2 chữ, ví dụ SG, JP, TW"),
    country_name: text(100),
    currency_code: currency,
    is_active: z.enum(["true", "false"]).transform((v) => v === "true"),
  })
  .refine(hasVersion, versionMessage);
export const orderSchema = z
  .object({
    ...version,
    market_id: z.uuid("Vui lòng chọn thị trường"),
    employer: text(300),
    industry: text(200),
    recruitment_quantity: z.coerce
      .number()
      .int("Số lượng tuyển phải là số nguyên")
      .min(1)
      .max(1000000),
    salary_amount: z.coerce
      .number()
      .positive("Lương phải lớn hơn 0")
      .max(999999999999.99)
      .multipleOf(0.01, "Lương tối đa 2 chữ số thập phân"),
    salary_currency: currency,
    salary_period: z.enum(["hour", "day", "month", "year"]),
    conditions: text(5000),
    recruitment_deadline: z.iso
      .date("Vui lòng nhập hạn tuyển hợp lệ")
      .refine((v) => v >= "1900-01-01", "Hạn tuyển không hợp lệ"),
    partner: text(300),
    status: z.enum(["open", "paused", "closed"]),
  })
  .refine(hasVersion, versionMessage);
export const orderFiltersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  market: z.union([z.literal(""), z.uuid()]).default(""),
  status: z.enum(["", "open", "paused", "closed"]).default(""),
  deadline: z.enum(["", "current", "expired"]).default(""),
  page: z.coerce.number().int().min(0).max(1000000).default(0),
});
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
export function recruitmentExpired(
  order: Pick<RecruitmentOrder, "status" | "recruitment_deadline">,
  today: string,
) {
  return order.status === "open" && order.recruitment_deadline < today;
}
export function formatOrderSalary(
  order: Pick<
    RecruitmentOrder,
    "salary_amount" | "salary_currency" | "salary_period"
  >,
) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(order.salary_amount)} ${order.salary_currency} / ${SALARY_PERIODS[order.salary_period].toLowerCase()}`;
}
