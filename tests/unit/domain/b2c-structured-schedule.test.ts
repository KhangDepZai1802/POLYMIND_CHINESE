import { describe,expect,it } from "vitest";
import {scheduleSchema,countPlannedMeetings} from "@/features/b2c/domain/structured-schedule";
const valid={class_id:"77000000-0000-4000-8000-000000000010",request_id:"77000000-0000-4000-8000-000000000050",weekdays:[1,3],start_time:"18:00",end_time:"19:30",room_name:"",date_from:"2026-01-05",date_to:"2026-01-14"};
describe("Structured B2C schedule",()=>{
 it("previews inclusive matching weekdays",()=>expect(countPlannedMeetings([1,3],valid.date_from,valid.date_to)).toBe(4));
 it("accepts unassigned rooms and normalizes duplicate weekdays",()=>expect(scheduleSchema.parse({...valid,weekdays:[3,1,3]}).weekdays).toEqual([1,3]));
 it.each([{weekdays:[]},{weekdays:[0]},{end_time:"17:00"},{end_time:"18:00"},{start_time:"01:00",end_time:"14:00"},{date_to:"2026-01-01"},{date_to:"2027-01-07"},{room_name:"x".repeat(121)}])("rejects invalid plan %j",bad=>expect(scheduleSchema.safeParse({...valid,...bad}).success).toBe(false));
 it("handles Sunday and a one-day range",()=>expect(countPlannedMeetings([7],"2026-01-11","2026-01-11")).toBe(1));
 it("does not preview unbounded or invalid date ranges",()=>{expect(countPlannedMeetings([1],"bad","bad")).toBe(0);expect(countPlannedMeetings([1],"2026-01-01","2028-01-01")).toBe(0);});
});
