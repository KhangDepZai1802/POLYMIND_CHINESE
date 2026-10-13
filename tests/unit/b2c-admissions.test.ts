import { describe, it, expect } from "vitest";
import { b2cAdmissionSchema } from "@/features/b2c/schema";
import { ADMISSION_STAGES } from "@/features/b2c/domain/admissions";
const valid = { id: "", full_name: "Khách mới", phone: "0912345678", program_slug: "tieng-anh", salesperson: "Giáo vụ", stage: "lead", customer_source: "", referrer_name: "", notes: "", failure_reason: "" };
describe("Pipeline tuyển sinh B2C", () => {
  it.each(ADMISSION_STAGES)("nhận giai đoạn %s", (stage) => {
    expect(b2cAdmissionSchema.safeParse({ ...valid, stage, failure_reason: stage === "lost" ? "Không phù hợp lịch" : "" }).success).toBe(true);
  });
  it("thất bại bắt buộc lý do, mở lại xóa lý do", () => {
    expect(b2cAdmissionSchema.safeParse({ ...valid, stage: "lost", failure_reason: "  " }).success).toBe(false);
    expect(b2cAdmissionSchema.parse({ ...valid, failure_reason: "Lý do cũ" }).failure_reason).toBeNull();
  });
  it("chặn dữ liệu thiếu và trạng thái lạ", () => {
    for (const field of ["full_name", "phone", "program_slug", "salesperson"]) expect(b2cAdmissionSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
    expect(b2cAdmissionSchema.safeParse({ ...valid, stage: "unknown" }).success).toBe(false);
    expect(b2cAdmissionSchema.safeParse({ ...valid, customer_source: "referral" }).success).toBe(false);
  });
});
