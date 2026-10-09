import { describe, expect, it } from 'vitest';
import { job, runSnapshot } from '@trafaret/core/testing';
import { layoutTimeline } from './timeline';

/** Milliseconds after the run started (at t=1000). */
const at = (ms: number): number => 1_000 + ms;

describe('layoutTimeline', () => {
  it('places parallel branches side by side in time', () => {
    const run = runSnapshot(
      [
        job('a', { startedAt: at(0), finishedAt: at(5_000) }),
        job('b', { startedAt: at(1_000), finishedAt: at(8_000) }),
      ],
      { startedAt: at(0), finishedAt: at(8_000) },
    );
    const { spanMs, bars } = layoutTimeline(run, ['a', 'b'], at(9_000));
    expect(spanMs).toBe(8_000);
    expect(bars).toEqual([
      { nodeId: 'a', status: 'success', cached: false, start: 0, end: 0.625 },
      { nodeId: 'b', status: 'success', cached: false, start: 0.125, end: 1 },
    ]);
  });

  it('grows a running bar, and the timeline, until now', () => {
    const run = runSnapshot([job('a', { status: 'running', startedAt: at(1_000), finishedAt: null })], {
      status: 'running',
      startedAt: at(0),
      finishedAt: null,
    });
    expect(layoutTimeline(run, ['a'], at(2_000)).bars[0]).toMatchObject({ start: 0.5, end: 1 });
    expect(layoutTimeline(run, ['a'], at(4_000))).toMatchObject({
      spanMs: 4_000,
      bars: [{ start: 0.25, end: 1 }],
    });
  });

  it('draws a reused result as a zero-width mark at the start', () => {
    const run = runSnapshot(
      [
        job('a', { cached: true, startedAt: at(0), finishedAt: at(0) }),
        job('b', { startedAt: at(0), finishedAt: at(3_000) }),
      ],
      { startedAt: at(0), finishedAt: at(3_000) },
    );
    expect(layoutTimeline(run, ['a', 'b'], at(3_000)).bars[0]).toMatchObject({
      cached: true,
      start: 0,
      end: 0,
    });
  });

  it('marks a node that was skipped before it started at the moment it failed', () => {
    const run = runSnapshot(
      [
        job('a', { status: 'error', startedAt: at(0), finishedAt: at(2_000) }),
        job('b', { status: 'error', startedAt: null, finishedAt: at(2_000) }),
      ],
      { status: 'failed', startedAt: at(0), finishedAt: at(2_000) },
    );
    expect(layoutTimeline(run, ['a', 'b'], at(2_000)).bars[1]).toMatchObject({ start: 1, end: 1 });
  });

  it('gives a job that has not started no bar yet', () => {
    const run = runSnapshot([job('a', { status: 'queued', startedAt: null, finishedAt: null })], {
      status: 'running',
      startedAt: at(0),
      finishedAt: null,
    });
    expect(layoutTimeline(run, ['a'], at(500)).bars[0]).toMatchObject({ start: null, end: null });
  });

  it('keeps at least a second of timeline for a run that finished at once', () => {
    const run = runSnapshot([job('a', { cached: true, startedAt: at(0), finishedAt: at(0) })], {
      startedAt: at(0),
      finishedAt: at(0),
    });
    expect(layoutTimeline(run, ['a'], at(0)).spanMs).toBe(1_000);
  });

  it('skips nodes the run has no job for', () => {
    const run = runSnapshot([job('a')]);
    expect(layoutTimeline(run, ['a', 'added-later'], at(0)).bars.map((bar) => bar.nodeId)).toEqual(['a']);
  });
});
