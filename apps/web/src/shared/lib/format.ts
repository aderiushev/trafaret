/** 400 → "0.4 s", 13 400 → "13.4 s", 125 000 → "2 m 5 s". */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 60_000) return `${(safe / 1000).toFixed(1)} s`;
  const totalSeconds = Math.round(safe / 1000);
  return `${Math.floor(totalSeconds / 60)} m ${totalSeconds % 60} s`;
}

/** Whole seconds, for a live counter: 3 400 → "3 s". */
export const formatSeconds = (ms: number): string => `${Math.floor(Math.max(0, ms) / 1000)} s`;

/** pluralize(1, 'issue') → "1 issue"; pluralize(2, 'issue') → "2 issues". */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;
