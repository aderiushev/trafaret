import { describe, expect, it } from 'vitest';
import { DailyBudget } from './daily-budget.ts';

describe('DailyBudget', () => {
  it('allows calls up to the daily limit', () => {
    const budget = new DailyBudget({ cloudflare: 2 }, () => Date.parse('2026-10-08T10:00:00Z'));
    expect([
      budget.tryConsume('cloudflare'),
      budget.tryConsume('cloudflare'),
      budget.tryConsume('cloudflare'),
    ]).toEqual([true, true, false]);
  });

  it('starts over at 00:00 UTC', () => {
    let now = Date.parse('2026-10-08T23:59:00Z');
    const budget = new DailyBudget({ byteplus: 1 }, () => now);
    expect(budget.tryConsume('byteplus')).toBe(true);
    expect(budget.tryConsume('byteplus')).toBe(false);
    now = Date.parse('2026-10-09T00:00:01Z');
    expect(budget.tryConsume('byteplus')).toBe(true);
  });

  it('never limits providers without a configured cap', () => {
    const budget = new DailyBudget({ cloudflare: 0 });
    expect(budget.tryConsume('cloudflare')).toBe(false);
    expect(budget.tryConsume('mock')).toBe(true);
  });
});
