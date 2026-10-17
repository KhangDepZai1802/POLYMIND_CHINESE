export const LOW_ENROLLMENT_THRESHOLD = 5;

export function isLowEnrollment(count: number, status: string): boolean {
  return (
    status === "active" &&
    Number.isInteger(count) &&
    count >= 0 &&
    count < LOW_ENROLLMENT_THRESHOLD
  );
}
