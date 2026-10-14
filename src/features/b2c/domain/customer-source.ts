export const B2C_CUSTOMER_SOURCES = [
  "facebook",
  "zalo",
  "tiktok",
  "referral",
  "walk_in",
  "school",
  "other",
] as const;

export type B2CCustomerSource = (typeof B2C_CUSTOMER_SOURCES)[number];

export const B2C_CUSTOMER_SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  tiktok: "TikTok",
  referral: "Giới thiệu",
  walk_in: "Walk-in",
  school: "Trường học",
  other: "Khác",
};
