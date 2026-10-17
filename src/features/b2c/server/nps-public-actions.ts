"use server";
import { npsResponseSchema } from "../domain/nps";
import { npsPublicRpc } from "./nps-public";

export async function submitPublicNpsAction(form: FormData) {
  const rawScore = form.get("score");
  const p = npsResponseSchema.safeParse({ ...Object.fromEntries(form), score: rawScore === null || rawScore === "" ? null : Number(rawScore) });
  if (!p.success) return { error: "Chọn một điểm từ 0 đến 10. Mỗi góp ý tối đa 2.000 ký tự." };
  try {
    const { token, ...data } = p.data;
    await npsPublicRpc("submit_public_b2c_nps", { p_token: token, p_data: data });
    return { success: true };
  } catch (e) { return { error: e instanceof Error ? e.message : "Không gửi được phản hồi. Vui lòng thử lại." }; }
}
