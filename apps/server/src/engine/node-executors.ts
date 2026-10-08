import {
  assetUrl,
  type AspectRatio,
  type GraphIndex,
  type GraphNodeOf,
  type ImageOutput,
} from '@trafaret/core';
import type { JobModel, ProviderId } from '@trafaret/core';
import type { AssetStore, StoredAsset } from '../assets/asset-store.ts';
import { closestAspectRatio, toWebp } from '../assets/image.ts';
import type { ModelCatalog } from '../catalog/catalog.ts';
import type { ModelDefinition } from '../catalog/models.ts';
import type { Semaphore } from '../lib/semaphore.ts';
import type { PresetRepository } from '../library/preset-repository.ts';
import type { ImageProvider } from '../providers/types.ts';
import type { DailyBudget } from './daily-budget.ts';
import { JobFailure } from './errors.ts';
import { buildRequest } from './request-builder.ts';
import type { ExecutedNode, NodeExecutionContext, NodeExecutor, NodeInputs } from './run-execution.ts';

export type NodeExecutorDeps = {
  catalog: ModelCatalog;
  presets: PresetRepository;
  assets: AssetStore;
  providers: Partial<Record<ProviderId, ImageProvider>>;
  semaphore: Semaphore;
  budget: DailyBudget;
  jobTimeoutMs: number;
};

export const imageOutput = (asset: StoredAsset): ImageOutput => ({
  kind: 'image',
  assetId: asset.id,
  url: assetUrl(asset.id),
  width: asset.width,
  height: asset.height,
});

const imageGone = (): JobFailure =>
  new JobFailure({
    code: 'INVALID_INPUT',
    message: 'This image is no longer on the server. Upload it again.',
    retryable: false,
  });

const notConfigured = (): JobFailure =>
  new JobFailure({
    code: 'PROVIDER_ERROR',
    message: 'This model is not configured on the server.',
    retryable: false,
  });

export function createNodeExecutor(index: GraphIndex, deps: NodeExecutorDeps): NodeExecutor {
  return async ({ nodeId, inputs, attempt, markRunning }) => {
    const node = index.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown node ${nodeId}`);
    switch (node.type) {
      case 'prompt':
        markRunning();
        return { output: { kind: 'text', text: node.data.text } };
      case 'imageInput': {
        markRunning();
        const asset = node.data.assetId ? deps.assets.get(node.data.assetId) : undefined;
        if (!asset) throw imageGone();
        return { output: imageOutput(asset) };
      }
      case 'result':
        markRunning();
        if (inputs.image?.kind !== 'image') {
          throw new JobFailure({
            code: 'INTERNAL',
            message: 'The image for this result is missing. Run again.',
            retryable: true,
          });
        }
        return { output: inputs.image };
      case 'generateImage':
      case 'editImage':
        return await runAiNode(node, inputs, attempt, markRunning, deps);
    }
  };
}

async function runAiNode(
  node: GraphNodeOf<'generateImage'> | GraphNodeOf<'editImage'>,
  inputs: NodeInputs,
  attempt: number,
  markRunning: NodeExecutionContext['markRunning'],
  deps: NodeExecutorDeps,
): Promise<ExecutedNode> {
  const model = deps.catalog.definition(node.data.modelId);
  if (!model) throw notConfigured();
  const preset = node.data.presetId ? (deps.presets.get(node.data.presetId) ?? null) : null;

  let userText: string;
  let aspectRatio: AspectRatio;
  let sourceAssetId: string | null = null;
  if (node.type === 'generateImage') {
    userText = inputs.prompt?.kind === 'text' ? inputs.prompt.text : '';
    aspectRatio = node.data.aspectRatio;
  } else {
    const source = inputs.image?.kind === 'image' ? deps.assets.get(inputs.image.assetId) : undefined;
    if (!source) throw imageGone();
    userText = inputs.prompt?.kind === 'text' ? inputs.prompt.text : node.data.instruction;
    aspectRatio = closestAspectRatio(source.width, source.height);
    sourceAssetId = source.id;
  }

  const built = buildRequest({ userText, aspectRatio, seed: node.data.seed, model, preset, sourceAssetId });
  const images = built.referenceAssetIds.flatMap((id) => {
    const asset = deps.assets.get(id);
    return asset ? [{ bytes: asset.bytes, mime: asset.mime }] : [];
  });

  const release = await deps.semaphore.acquire();
  try {
    const target = pickProvider(model, deps);
    // From here on the job shows what it sends, while the call is pending and if it fails or times out.
    markRunning({ request: built.preview, model: target.jobModel });
    const result = await withTimeout(deps.jobTimeoutMs, (signal) =>
      target.provider.generate(
        {
          model: target.providerModel,
          mode: node.type === 'editImage' ? 'edit' : 'generate',
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          images,
          width: built.width,
          height: built.height,
          seed: built.seed,
          attempt,
        },
        signal,
      ),
    );
    const stored = await storeOutput(result.bytes, deps.assets);
    return { output: imageOutput(stored), request: built.preview, model: target.jobModel };
  } finally {
    release();
  }
}

type ProviderTarget = { provider: ImageProvider; providerModel: string; jobModel: JobModel };

/** The model's own provider while today's budget lasts; afterwards the Mock model, labelled as a fallback. */
function pickProvider(model: ModelDefinition, deps: NodeExecutorDeps): ProviderTarget {
  if (deps.budget.tryConsume(model.provider)) {
    const provider = deps.providers[model.provider];
    if (!provider) throw notConfigured();
    return {
      provider,
      providerModel: model.providerModel,
      jobModel: { id: model.id, provider: model.provider },
    };
  }
  const mock = deps.providers.mock;
  if (!mock) {
    throw new JobFailure({
      code: 'PROVIDER_ERROR',
      message: "Today's demo budget is used up. Try again after 00:00 UTC.",
      retryable: false,
    });
  }
  return {
    provider: mock,
    providerModel: 'mock',
    jobModel: { id: 'mock', provider: 'mock', fallbackFrom: model.id },
  };
}

async function storeOutput(bytes: Buffer, assets: AssetStore): Promise<StoredAsset> {
  let webp: Buffer;
  try {
    webp = await toWebp(bytes);
  } catch {
    throw new JobFailure({
      code: 'PROVIDER_ERROR',
      message: 'The AI service returned an unreadable image. Retry in a few seconds.',
      retryable: true,
    });
  }
  return assets.put(webp);
}

async function withTimeout<T>(timeoutMs: number, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  const timedOut = (): JobFailure =>
    new JobFailure({
      code: 'TIMEOUT',
      message: `No answer from the AI service in ${Math.max(1, Math.round(timeoutMs / 1000))} s. Retry to try again.`,
      retryable: true,
    });
  // Race the deadline too: a provider that ignores the signal must not hold the job (and its permit) forever.
  let onAbort = (): void => undefined;
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => reject(timedOut());
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([call(signal), deadline]);
  } catch (error) {
    if (signal.aborted) throw timedOut();
    throw error;
  } finally {
    // The race only subscribes to `deadline` once `call` returned a promise. Detach it so that a rejection can never
    // arrive later without a subscriber (e.g. when `call` threw synchronously), which would be an unhandled rejection.
    signal.removeEventListener('abort', onAbort);
  }
}
