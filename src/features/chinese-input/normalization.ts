export type NormalizationConfig = {
  trimSpaces?: boolean;
  collapseInternalSpaces?: boolean;
  ignorePunctuation?: boolean;
  caseInsensitiveLatin?: boolean;
  normalizeUmlaut?: boolean;
};

export function normalizeChineseAnswer(
  value: string,
  config: NormalizationConfig = {},
) {
  let result = value.normalize("NFC");
  if (config.normalizeUmlaut)
    result = result.replace(/u:|v/gi, (match) =>
      match === match.toUpperCase() ? "Ü" : "ü",
    );
  if (config.trimSpaces ?? true) result = result.trim();
  if (config.collapseInternalSpaces) result = result.replace(/\s+/g, " ");
  if (config.ignorePunctuation) result = result.replace(/[\p{P}\p{S}]/gu, "");
  if (config.caseInsensitiveLatin) result = result.toLocaleLowerCase("vi");
  return result;
}

export function matchesAcceptedAnswer(
  value: string,
  accepted: string[],
  config?: NormalizationConfig,
) {
  const normalized = normalizeChineseAnswer(value, config);
  return accepted.some(
    (candidate) => normalizeChineseAnswer(candidate, config) === normalized,
  );
}
