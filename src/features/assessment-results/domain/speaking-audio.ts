const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
};

export function speakingAudioFormat(mimeType: string) {
  const normalizedMime = mimeType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  const extension = AUDIO_EXTENSIONS[normalizedMime];
  return extension ? { mimeType: normalizedMime, extension } : null;
}
