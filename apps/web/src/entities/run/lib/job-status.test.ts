import { describe, expect, it } from 'vitest';
import type { JobError } from '@trafaret/core';
import { branchingGraph, job } from '@trafaret/core/testing';
import { isNodeEdited, jobDurationMs, retryTarget } from './job-status';

const failure = (fields: Partial<JobError> = {}): JobError => ({
  code: 'PROVIDER_ERROR',
  message: 'The AI service is busy. Retry in a few seconds.',
  retryable: true,
  ...fields,
});

describe('retryTarget', () => {
  it('retries a failed node itself', () => {
    expect(retryTarget(job('gen-a', { status: 'error', error: failure() }))).toBe('gen-a');
  });

  it('sends a skipped node to the failure that caused it', () => {
    const skipped = job('result-a', {
      nodeType: 'result',
      status: 'error',
      startedAt: null,
      error: failure({
        code: 'UPSTREAM_FAILED',
        message: 'Skipped: Generate Image failed.',
        upstreamNodeId: 'gen-a',
      }),
    });
    expect(retryTarget(skipped)).toBe('gen-a');
  });

  it('offers nothing when a retry cannot help', () => {
    expect(retryTarget(job('gen-a', { status: 'error', error: failure({ retryable: false }) }))).toBeNull();
    expect(retryTarget(job('gen-a'))).toBeNull();
  });
});

describe('jobDurationMs', () => {
  it('measures a finished job, and a running one up to now', () => {
    expect(jobDurationMs(job('a', { startedAt: 1_000, finishedAt: 2_500 }), 9_000)).toBe(1_500);
    expect(jobDurationMs(job('a', { status: 'running', startedAt: 1_000, finishedAt: null }), 4_000)).toBe(
      3_000,
    );
  });

  it('has no duration for a reused result or a job that never started', () => {
    expect(jobDurationMs(job('a', { cached: true }), 9_000)).toBeNull();
    expect(
      jobDurationMs(job('a', { status: 'queued', startedAt: null, finishedAt: null }), 9_000),
    ).toBeNull();
  });
});

describe('isNodeEdited', () => {
  const submitted = branchingGraph();

  it('is false while the settings match the run', () => {
    expect(
      isNodeEdited('gen-a', { modelId: 'mock', presetId: null, aspectRatio: '1:1', seed: 1 }, submitted),
    ).toBe(false);
  });

  it('is true once a setting changed', () => {
    expect(
      isNodeEdited(
        'gen-a',
        { modelId: 'mock', presetId: 'lifestyle', aspectRatio: '1:1', seed: 1 },
        submitted,
      ),
    ).toBe(true);
  });

  it('is false without a run, and for nodes the run did not have', () => {
    expect(isNodeEdited('gen-a', { seed: 7 }, null)).toBe(false);
    expect(isNodeEdited('new-node', { text: 'hi' }, submitted)).toBe(false);
  });
});
