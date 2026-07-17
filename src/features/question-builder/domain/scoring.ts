export function scaleScore(
  rawScore: number,
  rawMax: number,
  targetMax: number,
  penaltyPercent = 0,
) {
  if (rawMax <= 0 || targetMax <= 0) return 0;
  const base = (Math.max(0, rawScore) / rawMax) * targetMax;
  return Math.max(
    0,
    Math.round(
      base * (1 - Math.min(100, Math.max(0, penaltyPercent)) / 100) * 100,
    ) / 100,
  );
}

export function partialMultiSelectScore(
  correctSelected: number,
  correctTotal: number,
  maxPoints: number,
  selectedWrong = false,
  wrongSelectionZero = false,
) {
  if (
    correctTotal <= 0 ||
    maxPoints <= 0 ||
    (selectedWrong && wrongSelectionZero)
  )
    return 0;
  return Math.max(
    0,
    Math.round(
      ((maxPoints * Math.min(correctSelected, correctTotal)) / correctTotal) *
        100,
    ) / 100,
  );
}
