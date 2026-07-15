import { timingSafeEqual } from "node:crypto";

export function hasValidCronAuthorization(
  authorization: string | null,
  secret: string,
) {
  if (!authorization?.startsWith("Bearer ") || secret.length === 0) {
    return false;
  }

  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
