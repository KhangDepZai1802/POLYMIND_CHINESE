import { fireEvent,render,screen,waitFor,within } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { TeacherPermissionsDialog } from "@/features/b2c/components/teacher-permissions-dialog";
import { DEFAULT_B2C_PERMISSIONS } from "@/features/b2c/domain/teacher-permissions";
import { readB2CPermissionAdminAction,saveB2CPermissionsAction } from "@/features/b2c/server/permission-actions";
import { toast } from "sonner";
vi.mock("sonner",()=>({toast:{success:vi.fn()}}));
vi.mock("@/features/b2c/server/permission-actions",()=>({readB2CPermissionAdminAction:vi.fn(),saveB2CPermissionsAction:vi.fn()}));
beforeEach(()=>{
 vi.clearAllMocks();
 vi.mocked(readB2CPermissionAdminAction).mockResolvedValue({teachers:[{id:"b2c-a",full_name:"Cô A",source_teacher_id:"account-a",account_name:"Tài khoản A",active:true,permissions:[...DEFAULT_B2C_PERMISSIONS],updated_at:"2026-10-15T01:00:00Z"},{id:"b2c-b",full_name:"Thầy B",source_teacher_id:null,account_name:null,active:false,permissions:[...DEFAULT_B2C_PERMISSIONS],updated_at:null}],accounts:[{id:"account-a",full_name:"Tài khoản A"},{id:"account-b",full_name:"Tài khoản B"}]});
 vi.mocked(saveB2CPermissionsAction).mockResolvedValue({success:"Đã lưu phân quyền."});
});
async function open(){render(<TeacherPermissionsDialog/>);fireEvent.click(screen.getByRole("button",{name:"Phân quyền"}));await screen.findByRole("combobox",{name:"Giáo viên"});fireEvent.change(screen.getByRole("combobox",{name:"Giáo viên"}),{target:{value:"b2c-a"}});return within(screen.getByRole("dialog"));}
describe("Teacher permission editor",()=>{
 it("loads current rights, stages checkbox changes and saves the selected teacher/account/version",async()=>{
  const dialog=await open();
  expect(dialog.getByRole("checkbox",{name:"Xem các lớp được phân công"})).toBeChecked();
  expect(dialog.getByRole("checkbox",{name:"Điểm danh học viên"})).not.toBeChecked();
  fireEvent.click(dialog.getByRole("checkbox",{name:"Điểm danh học viên"}));
  expect(saveB2CPermissionsAction).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole("button",{name:"Lưu phân quyền"}));
  await waitFor(()=>expect(saveB2CPermissionsAction).toHaveBeenCalledWith({teacher_id:"b2c-a",source_teacher_id:"account-a",permissions:[...DEFAULT_B2C_PERMISSIONS.slice(0,4),"mark_attendance",...DEFAULT_B2C_PERMISSIONS.slice(4)],expected_updated_at:"2026-10-15T01:00:00Z"}));
  await waitFor(()=>expect(toast.success).toHaveBeenCalledWith("Đã lưu phân quyền thành công",{position:"top-center",duration:4500}));
 });
 it("cascades dependencies and can link an existing unused account",async()=>{
  const dialog=await open();
  fireEvent.click(dialog.getByRole("checkbox",{name:"Xem các lớp được phân công"}));
  fireEvent.click(dialog.getByRole("checkbox",{name:"Thu học phí, lập phiếu thu"}));
  expect(dialog.getByRole("checkbox",{name:"Xem học phí và phiếu thu của lớp"})).toBeChecked();
  expect(dialog.getByRole("checkbox",{name:"Tạo/sửa gói học phí"})).not.toBeChecked();
  fireEvent.change(dialog.getByRole("combobox",{name:"Giáo viên"}),{target:{value:"b2c-b"}});
  expect(dialog.getByRole("button",{name:"Lưu phân quyền"})).toBeDisabled();
  fireEvent.change(dialog.getByRole("combobox",{name:"Tài khoản giáo viên hiện có"}),{target:{value:"account-b"}});
  fireEvent.click(dialog.getByRole("button",{name:"Lưu phân quyền"}));
  await waitFor(()=>expect(saveB2CPermissionsAction).toHaveBeenCalledWith(expect.objectContaining({teacher_id:"b2c-b",source_teacher_id:"account-b",expected_updated_at:null})));
 });
 it("keeps the editor open when the server rejects a stale update",async()=>{
  vi.mocked(saveB2CPermissionsAction).mockResolvedValue({error:"Quyền đã thay đổi. Tải lại trước khi lưu."});
  const dialog=await open();fireEvent.click(dialog.getByRole("button",{name:"Lưu phân quyền"}));
  expect(await dialog.findByRole("alert")).toHaveTextContent("Quyền đã thay đổi");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
 });
});
