import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/permissions/routes";
import { permissionRpc } from "./permission-rpc";

export async function requireAdmissionsAccess() {
  const user = await requireUser();
  const allowed = await permissionRpc<boolean>("has_b2c_permission", {
    p_key: "manage_admissions",
  });
  if (!allowed) redirect(homePathForRole(user.role));
  return user;
}
