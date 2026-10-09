import { describe, expect, it } from 'vitest';
import { formatDuration, formatSeconds, pluralize } from './format';

describe('format', () => {
  it('shows durations under a minute with one decimal', () => {
    expect(formatDuration(0)).toBe('0.0 s');
    expect(formatDuration(400)).toBe('0.4 s');
    expect(formatDuration(13_449)).toBe('13.4 s');
  });

  it('shows longer durations in minutes and seconds', () => {
    expect(formatDuration(125_000)).toBe('2 m 5 s');
  });

  it('never shows a negative duration', () => {
    expect(formatDuration(-20)).toBe('0.0 s');
    expect(formatSeconds(-20)).toBe('0 s');
  });

  it('counts whole seconds for live counters', () => {
    expect(formatSeconds(3_999)).toBe('3 s');
  });

  it('pluralizes', () => {
    expect(pluralize(1, 'issue')).toBe('1 issue');
    expect(pluralize(3, 'issue')).toBe('3 issues');
    expect(pluralize(2, 'AI call')).toBe('2 AI calls');
  });
});
