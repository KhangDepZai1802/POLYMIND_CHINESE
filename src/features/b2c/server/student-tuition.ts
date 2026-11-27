import "server-only";

import {
  b2cStudentTuitionPageSchema,
  type B2CStudentTuitionPage,
} from "@/features/b2c/domain/student-tuition";
import { requireRole } from "@/lib/auth/session";
import { permissionRpc } from "./permission-rpc";

export async function getMyB2CTuition(): Promise<B2CStudentTuitionPage> {
  await requireRole("student");
  return b2cStudentTuitionPageSchema.parse(
    await permissionRpc<unknown>("read_my_b2c_tuition"),
  );
}
