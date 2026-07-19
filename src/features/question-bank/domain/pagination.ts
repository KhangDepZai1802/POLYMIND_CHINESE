export const QUESTION_PAGE_SIZE = 20;

export function clampQuestionPage(
  requestedPage: string | number | undefined,
  count: number,
) {
  const parsed = Number(requestedPage);
  const requested = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  const totalPages = Math.max(1, Math.ceil(count / QUESTION_PAGE_SIZE));
  return { page: Math.min(requested, totalPages), totalPages };
}

export function questionPageHref(
  basePath: string,
  filters: { q?: string; skill?: string; visibility?: string },
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.skill) params.set("skill", filters.skill);
  if (filters.visibility) params.set("visibility", filters.visibility);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
