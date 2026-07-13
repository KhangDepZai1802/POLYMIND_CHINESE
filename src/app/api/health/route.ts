import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check.
 *
 * Cố tình tối giản: KHÔNG trả version, commit SHA, tên schema, biến môi trường
 * hay trạng thái kết nối DB. Endpoint này công khai — mọi thứ nó nói ra là thứ
 * kẻ tấn công đọc được miễn phí.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
