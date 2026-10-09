import type { Run } from '@trafaret/core';
import { formatDuration, pluralize } from '@/shared/lib';

/** "2 AI calls · 13.4 s · 1 reused · saved ~12.1 s" */
export function formatRunSummary(run: Run, now: number): string {
  const { generated, fallbacks, reused, failed, savedMs } = run.summary;
  const parts = [pluralize(generated + fallbacks, 'AI call')];
  if (run.startedAt !== null) parts.push(formatDuration((run.finishedAt ?? now) - run.startedAt));
  if (reused > 0) parts.push(`${reused} reused`);
  if (failed > 0) parts.push(`${failed} failed`);
  if (savedMs > 0) parts.push(`saved ~${formatDuration(savedMs)}`);
  if (fallbacks > 0) parts.push(`${fallbacks} on Mock (daily limit)`);
  return parts.join(' · ');
}
