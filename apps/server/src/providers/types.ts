import type { ProviderId } from '@trafaret/core';

export type ProviderImage = { bytes: Buffer; mime: string };

export type ProviderRequest = {
  /** The provider's own model identifier, e.g. `seedream-4-5-251128`. */
  model: string;
  mode: 'generate' | 'edit';
  prompt: string;
  /** Only for models with a native negative-prompt field; otherwise it is already folded into `prompt`. */
  negativePrompt: string | null;
  /** Edit source first, then preset references. */
  images: ProviderImage[];
  width: number;
  height: number;
  seed: number | null;
  /** 1 on a job's first run, +1 for every retry. */
  attempt: number;
};

export type ProviderResult = { bytes: Buffer };

export interface ImageProvider {
  readonly id: ProviderId;
  generate(request: ProviderRequest, signal: AbortSignal): Promise<ProviderResult>;
}

export type ProviderErrorCode = 'PROVIDER_ERROR' | 'INVALID_INPUT';

/** A provider failure with a user-facing message; `detail` is for server logs only. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly detail: string | undefined;

  constructor(code: ProviderErrorCode, message: string, retryable: boolean, detail?: string) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
    this.detail = detail;
  }
}
