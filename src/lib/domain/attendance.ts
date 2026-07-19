export const DEFAULT_ATTENDANCE_SCORE = 10;
export const ABSENCE_SCORE_DEDUCTION = 0.5;

export function calculateAttendanceScore(absentCount: number | null | undefined) {
  const normalizedAbsences = Math.max(0, Math.floor(Number(absentCount) || 0));
  return Math.max(
    0,
    DEFAULT_ATTENDANCE_SCORE - normalizedAbsences * ABSENCE_SCORE_DEDUCTION,
  );
}

export function formatAttendanceScore(absentCount: number | null | undefined) {
  const score = calculateAttendanceScore(absentCount);
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
