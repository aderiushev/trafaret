export type CapturedRequest = { url: string; init: RequestInit };

/** A fetch stand-in that records every call and answers each with the same `response` (its body reads once). */
export function stubFetch(response: Response): { fetch: typeof fetch; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : String(input), init: init ?? {} });
    return Promise.resolve(response);
  }) as typeof fetch;
  return { fetch: fetchStub, calls };
}
