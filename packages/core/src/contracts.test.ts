import { describe, expect, it } from 'vitest';
import { assetParamsSchema, assetUrl, createRunBodySchema, errorEnvelopeSchema } from './api.ts';
import { imageModelSchema } from './catalog.ts';
import { presetSchema } from './preset.ts';
import { emptyRunSummary, isTerminalRunStatus, runSchema, type Run } from './run.ts';
import { branchingGraph } from './testing.ts';

const sampleRun: Run = {
  id: 'run_abc',
  status: 'running',
  version: 3,
  createdAt: 1,
  startedAt: 2,
  finishedAt: null,
  jobs: {
    prompt: {
      nodeId: 'prompt',
      nodeType: 'prompt',
      status: 'success',
      attempt: 1,
      startedAt: 2,
      finishedAt: 2,
      cached: false,
      output: { kind: 'text', text: 'hi' },
    },
    'gen-a': {
      nodeId: 'gen-a',
      nodeType: 'generateImage',
      status: 'error',
      attempt: 1,
      startedAt: 2,
      finishedAt: 5,
      cached: false,
      error: { code: 'TIMEOUT', message: 'No answer.', retryable: true },
      request: {
        modelId: 'mock',
        prompt: 'hi',
        negativePrompt: null,
        negativeMode: 'none',
        references: [],
        aspectRatio: '1:1',
        seed: 1,
        warnings: [],
      },
    },
  },
  summary: emptyRunSummary(),
};

describe('contracts', () => {
  it('parses a run snapshot', () => {
    expect(runSchema.parse(sampleRun)).toEqual(sampleRun);
  });

  it('knows which run statuses are final', () => {
    expect(isTerminalRunStatus('completed')).toBe(true);
    expect(isTerminalRunStatus('failed')).toBe(true);
    expect(isTerminalRunStatus('queued')).toBe(false);
    expect(isTerminalRunStatus('running')).toBe(false);
  });

  it("accepts a preset in exactly the brief's shape", () => {
    const preset = {
      id: 'premium-3d',
      name: 'Premium 3D',
      mainPrompt: 'premium minimal 3D visual',
      negativePrompt: 'clutter, noisy background',
      references: ['/references/ref-1.png', '/references/ref-2.png'],
    };
    expect(presetSchema.parse(preset)).toEqual(preset);
  });

  it('describes models by capability', () => {
    expect(
      imageModelSchema.safeParse({
        id: 'mock',
        label: 'Mock',
        provider: 'mock',
        default: true,
        enabled: true,
        unavailableReason: null,
        supportsEdit: true,
        supportsNegativePrompt: true,
        supportsSeed: true,
        maxReferenceImages: 14,
        aspectRatios: ['1:1'],
        costPerImageUsd: 0,
      }).success,
    ).toBe(true);
  });

  it('wraps a graph in the create-run body', () => {
    expect(createRunBodySchema.safeParse({ graph: branchingGraph() }).success).toBe(true);
  });

  it('describes errors with one envelope', () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: {
          code: 'INVALID_GRAPH',
          message: 'Fix 1 issue.',
          issues: [{ code: 'CYCLE', message: 'Loop.' }],
        },
      }).success,
    ).toBe(true);
  });

  it('builds asset URLs from SHA-256 ids', () => {
    const id = 'f'.repeat(64);
    expect(assetUrl(id)).toBe(`/api/assets/${id}`);
    expect(assetParamsSchema.safeParse({ assetId: id }).success).toBe(true);
    expect(assetParamsSchema.safeParse({ assetId: '../etc/passwd' }).success).toBe(false);
  });
});
