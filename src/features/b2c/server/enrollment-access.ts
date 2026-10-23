import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/permissions/routes";
import { permissionRpc } from "./permission-rpc";

export async function requireB2CEnrollmentAccess() {
  const user = await requireUser();
  if (!await permissionRpc<boolean>("can_add_b2c_students")) redirect(homePathForRole(user.role));
  return user;
}
