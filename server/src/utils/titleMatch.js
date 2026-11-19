/**
 * Matching a title from one provider to the same title at another provider.
 *
 * Wrong matches are worse than no match (episodes of the wrong show would be attached to a user's
 * progress), so this is deliberately strict: the NORMALIZED title must be equal, and when both
 * years are known they must be within one year of each other. An ambiguous result (several equally
 * good candidates and no year to separate them) is rejected.
 */
export function normalizeTitle(title) {
  return String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/, '') // "Doctor Who (2005)" == "Doctor Who"
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @param {{ name: string, year: number|null }[]} candidates
 * @param {{ title: string, year: number|null }} wanted
 * @returns the best candidate, or null
 */
export function pickTitleMatch(candidates, { title, year }) {
  const wanted = normalizeTitle(title);
  if (!wanted) return null;
  const exact = (candidates ?? []).filter((c) => normalizeTitle(c.name) === wanted);
  if (exact.length === 0) return null;

  if (year == null) return exact.length === 1 ? exact[0] : null; // several equal titles and nothing to tell them apart

  const withYear = exact
    .filter((c) => c.year == null || Math.abs(c.year - year) <= 1)
    .map((c) => ({ c, diff: c.year == null ? 1.5 : Math.abs(c.year - year) }))
    .sort((a, b) => a.diff - b.diff);
  if (withYear.length === 0) return null;
  // two candidates equally close in year: ambiguous
  if (withYear.length > 1 && withYear[0].diff === withYear[1].diff) return null;
  return withYear[0].c;
}
