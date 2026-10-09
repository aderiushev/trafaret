import { describe, expect, it } from 'vitest';
import { edgeClientKey } from './client-key.ts';

const request = (headers: Record<string, string>, ip = '10.0.0.5') => ({ headers, ip });

describe('edgeClientKey', () => {
  it('keys a request by the visitor address the edge reports', () => {
    expect(edgeClientKey(request({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('ignores X-Forwarded-For, which the client controls', () => {
    const spoofed = request({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' });
    expect(edgeClientKey(spoofed)).toBe('203.0.113.7');
  });

  it('falls back to the connecting address without the edge header', () => {
    expect(edgeClientKey(request({}))).toBe('10.0.0.5');
    expect(edgeClientKey(request({ 'cf-connecting-ip': '' }))).toBe('10.0.0.5');
  });

  it('counts IPv6 visitors per /64 block', () => {
    const a = edgeClientKey(request({ 'cf-connecting-ip': '2001:db8:1:2:aaaa::1' }));
    const b = edgeClientKey(request({ 'cf-connecting-ip': '2001:db8:1:2:bbbb::2' }));
    const other = edgeClientKey(request({ 'cf-connecting-ip': '2001:db8:1:3::1' }));
    expect(a).toBe(b);
    expect(other).not.toBe(a);
  });
});
