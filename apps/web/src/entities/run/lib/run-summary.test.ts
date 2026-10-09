import { describe, expect, it } from 'vitest';
import { runSnapshot } from '@trafaret/core/testing';
import { formatRunSummary } from './run-summary';

describe('formatRunSummary', () => {
  it('summarises a finished run', () => {
    const run = runSnapshot([], {
      startedAt: 1_000,
      finishedAt: 14_400,
      summary: { aiNodes: 3, generated: 2, reused: 1, failed: 0, savedMs: 12_100, fallbacks: 0 },
    });
    expect(formatRunSummary(run, 99_000)).toBe('2 AI calls · 13.4 s · 1 reused · saved ~12.1 s');
  });

  it('counts a running run up to now and mentions failures and budget fallbacks', () => {
    const run = runSnapshot([], {
      status: 'running',
      startedAt: 1_000,
      finishedAt: null,
      summary: { aiNodes: 2, generated: 0, reused: 0, failed: 1, savedMs: 0, fallbacks: 1 },
    });
    expect(formatRunSummary(run, 3_500)).toBe('1 AI call · 2.5 s · 1 failed · 1 on Mock (daily limit)');
  });
});
