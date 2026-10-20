const CHINESE_CHAR_REGEX = /[\u3400-\u9fff]/;

// Matches contiguous Chinese phrases (including numbers attached to Chinese units like 2018年7月20号 and internal Chinese punctuation)
const CHINESE_PHRASE_REGEX =
  /(?:\d+(?=[\u3400-\u9fff])|[\u3400-\u9fff])(?:[\u3400-\u9fff\d，。？！、；：“”‘’]|(?<=[\u3400-\u9fff])[!?,.\s]+(?=[\u3400-\u9fff\d]))*/g;

const DIALOGUE_LINE_REGEX = /^([\u3400-\u9fff]{1,6})\s*[:：]\s*(.+)$/;

export function hasChinese(text: string): boolean {
  return CHINESE_CHAR_REGEX.test(text);
}

export function extractChineseSegments(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed || !hasChinese(trimmed)) return [];

  // If it's a dialogue line like "海伦: 小明，这附近有银行吗？", extract from the spoken part after ":"
  const dialogueMatch = DIALOGUE_LINE_REGEX.exec(trimmed);
  const spokenPart = dialogueMatch?.[2];
  const target = spokenPart && hasChinese(spokenPart) ? spokenPart : trimmed;

  const matches = target.match(CHINESE_PHRASE_REGEX);
  if (!matches) return [];

  return matches
    .map((segment) => segment.trim())
    .filter((segment) => hasChinese(segment));
}

export function extractSpeakableChinese(text: string): string {
  const segments = extractChineseSegments(text);
  if (segments.length === 0) return "";
  return segments.join("，");
}

