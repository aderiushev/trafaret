import { normalizeIP } from '@fastify/rate-limit';
import type { FastifyRequest } from 'fastify';

/**
 * Who a request comes from, for rate limiting behind the demo host's edge. Render runs behind Cloudflare, which
 * sets cf-connecting-ip to the visitor's address and replaces any value a client sends. X-Forwarded-For can't be
 * trusted there: Render appends to whatever the client wrote, so its first entry is the client's own claim.
 * A request without the header didn't come through the edge and is keyed by its connecting address. IPv6
 * addresses count per /64, the block one subscriber usually holds.
 */
export function edgeClientKey(request: Pick<FastifyRequest, 'headers' | 'ip'>): string {
  const visitor = request.headers['cf-connecting-ip'];
  return normalizeIP(typeof visitor === 'string' && visitor !== '' ? visitor : request.ip);
}
