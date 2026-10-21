import "server-only";
import { revalidatePath } from "next/cache";

// Teacher and manager screens read the same records. Invalidate both trees
// only after a successful write, including summaries outside the class page.
export function revalidateB2CViews() {
  revalidatePath("/admin/b2c", "layout");
  revalidatePath("/teacher", "layout");
}
