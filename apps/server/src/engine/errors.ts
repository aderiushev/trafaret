import type { JobError } from '@trafaret/core';
import { ProviderError } from '../providers/types.ts';

/** A failure that already carries its user-facing job error. */
export class JobFailure extends Error {
  readonly jobError: JobError;

  constructor(jobError: JobError) {
    super(jobError.message);
    this.name = 'JobFailure';
    this.jobError = jobError;
  }
}

export function toJobError(error: unknown): JobError {
  if (error instanceof JobFailure) return error.jobError;
  if (error instanceof ProviderError)
    return { code: error.code, message: error.message, retryable: error.retryable };
  return {
    code: 'INTERNAL',
    message: 'Something went wrong on our side. Retry in a few seconds.',
    retryable: true,
  };
}
