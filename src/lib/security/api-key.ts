import { timingSafeEqual } from "node:crypto";

export function hasValidApiKey(supplied: string | null, expected: string) {
  if (!supplied || expected.length === 0) return false;

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}
