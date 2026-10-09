import ky, { isHTTPError, isNetworkError, isTimeoutError, SchemaValidationError } from 'ky';
import { errorEnvelopeSchema, type Issue } from '@trafaret/core';

/** A failed API call, with a message the UI can show as it is. */
export class ApiError extends Error {
  /** 0 when no HTTP response arrived. */
  readonly status: number;
  readonly code: string;
  readonly issues: readonly Issue[];

  constructor(status: number, code: string, message: string, issues: readonly Issue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

/** Paths are relative to /api. No automatic retries: a repeated POST could start a second paid run. */
export const http = ky.create({ prefix: '/api', retry: 0, timeout: 30_000 });

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isHTTPError(error)) {
    const { status } = error.response;
    const envelope = errorEnvelopeSchema.safeParse(error.data);
    if (envelope.success) {
      const { code, message, issues = [] } = envelope.data.error;
      return new ApiError(status, code, message, issues);
    }
    return status >= 500
      ? new ApiError(status, 'HTTP_ERROR', 'The server is unavailable. Try again in a moment.')
      : new ApiError(status, 'HTTP_ERROR', `The server refused the request (${status}).`);
  }
  if (isTimeoutError(error)) {
    return new ApiError(0, 'TIMEOUT', 'The server took too long to answer. Try again.');
  }
  if (isNetworkError(error)) {
    return new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }
  if (error instanceof SchemaValidationError) {
    return new ApiError(0, 'BAD_RESPONSE', 'The server sent an unexpected response.');
  }
  return new ApiError(0, 'UNKNOWN', 'Something went wrong. Try again.');
}

// Checked by name: the DOMException class can differ between the fetch implementation and the page.
const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

/** Awaits one API call and rethrows its failure as an ApiError. A cancelled call passes through untouched. */
export async function request<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    throw isAbortError(error) ? error : toApiError(error);
  }
}
