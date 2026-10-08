import { ProviderError } from './types.ts';

const MODERATION = /sensitive|moderation|safety|nsfw|content.?(?:policy|filter)/i;
const UNAVAILABLE = "The AI service didn't respond. Retry in a few seconds.";

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');

/** POSTs to a provider and turns transport and HTTP failures into ProviderError. Abort errors pass through. */
export async function postToProvider(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, method: 'POST' });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ProviderError(
      'PROVIDER_ERROR',
      UNAVAILABLE,
      true,
      error instanceof Error ? error.message : 'network error',
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

/** Reads a provider's JSON body; a dropped connection or malformed body becomes a retryable ProviderError. Abort errors pass through. */
export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ProviderError(
      'PROVIDER_ERROR',
      'The AI service returned an unexpected response. Retry in a few seconds.',
      true,
      error instanceof Error ? error.message : 'unreadable response body',
    );
  }
}

export async function errorFromResponse(response: Response): Promise<ProviderError> {
  const body = await response.text().catch(() => '');
  const detail = `HTTP ${response.status}: ${body.slice(0, 500)}`;
  const { status } = response;
  if (status === 401 || status === 403) {
    return new ProviderError('PROVIDER_ERROR', "The server's AI credentials were rejected.", false, detail);
  }
  if (status === 429)
    return new ProviderError(
      'PROVIDER_ERROR',
      'The AI service is busy. Retry in a few seconds.',
      true,
      detail,
    );
  if (status >= 500) return new ProviderError('PROVIDER_ERROR', UNAVAILABLE, true, detail);
  if ((status === 400 || status === 422) && MODERATION.test(body)) {
    return new ProviderError(
      'INVALID_INPUT',
      'The model declined this prompt. Rephrase it and run again.',
      false,
      detail,
    );
  }
  return new ProviderError('INVALID_INPUT', rejectionMessage(body), false, detail);
}

function rejectionMessage(body: string): string {
  const text = extractMessage(body)
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  return text ? `The AI service rejected the request: ${text}` : 'The AI service rejected the request.';
}

function extractMessage(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }
  const candidates = [
    at(parsed, ['error', 'message']),
    at(parsed, ['errors', 0, 'message']),
    at(parsed, ['message']),
  ];
  return candidates.find((candidate): candidate is string => typeof candidate === 'string') ?? '';
}

const at = (value: unknown, path: ReadonlyArray<string | number>): unknown =>
  path.reduce<unknown>(
    (current, key) =>
      current !== null && typeof current === 'object'
        ? (current as Record<string | number, unknown>)[key]
        : undefined,
    value,
  );
