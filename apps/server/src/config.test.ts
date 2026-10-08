import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('applies the documented defaults', () => {
    expect(loadConfig({})).toMatchObject({
      env: 'development',
      host: '0.0.0.0',
      port: 8080,
      maxConcurrentJobs: 4,
      jobTimeoutMs: 120_000,
      dailyLimits: { cloudflare: 80, byteplus: 20 },
      mockLatencyMs: { min: 1200, max: 3500 },
      cloudflare: null,
      byteplus: null,
    });
  });

  it('treats empty keys as missing', () => {
    const config = loadConfig({ ARK_API_KEY: '', CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: '' });
    expect(config.byteplus).toBeNull();
    expect(config.cloudflare).toBeNull();
  });

  it('enables a provider only when all of its keys are present', () => {
    expect(loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc' }).cloudflare).toBeNull();
    expect(loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' }).cloudflare).toEqual({
      accountId: 'acc',
      apiToken: 'tok',
    });
    expect(loadConfig({ ARK_API_KEY: 'key' }).byteplus).toEqual({ apiKey: 'key' });
  });

  it('parses the mock latency range in either order', () => {
    expect(loadConfig({ MOCK_LATENCY_MS: '50-10' }).mockLatencyMs).toEqual({ min: 10, max: 50 });
  });

  it('fails fast with the name of the bad variable', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ MOCK_LATENCY_MS: 'fast' })).toThrow(/MOCK_LATENCY_MS/);
  });

  it('rejects a provider secret with a space or control character, without echoing it', () => {
    const load = () => loadConfig({ ARK_API_KEY: 'abc\ndef' });
    expect(load).toThrow(/ARK_API_KEY/);
    expect(load).toThrow(expect.objectContaining({ message: expect.not.stringContaining('abc') }));
    expect(() => loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc\r' })).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
    expect(() => loadConfig({ CLOUDFLARE_API_TOKEN: 'tok en' })).toThrow(/CLOUDFLARE_API_TOKEN/);
  });
});
