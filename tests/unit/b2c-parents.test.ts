import { describe, expect, it } from "vitest";
import { b2cParentSchema } from "@/features/b2c/schema";
const valid={id:"",full_name:"Phụ huynh B2C",phone:"",zalo:"",relationship:"unknown",student_codes:"B2C-HV000001, B2C-HV000002"};
describe("Phụ huynh",()=>{
  it("một phụ huynh nhiều con và bỏ mã lặp",()=>{
    expect(b2cParentSchema.parse({...valid,student_codes:"b2c-hv000001, B2C-HV000001; B2C-HV000002"}).student_codes).toEqual(["B2C-HV000001","B2C-HV000002"]);
  });
  it("không bắt buộc SĐT dữ liệu cũ nhưng kiểm tra khi nhập",()=>{
    expect(b2cParentSchema.safeParse(valid).success).toBe(true);
    expect(b2cParentSchema.safeParse({...valid,phone:"123"}).success).toBe(false);
  });
  it("chặn tên rỗng/mã sai",()=>{
    expect(b2cParentSchema.safeParse({...valid,full_name:" "}).success).toBe(false);
    expect(b2cParentSchema.safeParse({...valid,student_codes:"HV1"}).success).toBe(false);
  });
});
