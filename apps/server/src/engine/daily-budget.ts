import type { ProviderId } from '@trafaret/core';

/** Per-provider daily caps on real generations, reset at 00:00 UTC. Providers without a cap are unlimited. */
export class DailyBudget {
  private readonly limits: Partial<Record<ProviderId, number>>;
  private readonly now: () => number;
  private readonly used = new Map<ProviderId, number>();
  private day = '';

  constructor(limits: Partial<Record<ProviderId, number>>, now: () => number = Date.now) {
    this.limits = limits;
    this.now = now;
  }

  tryConsume(provider: ProviderId): boolean {
    const limit = this.limits[provider];
    if (limit === undefined) return true;
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.used.clear();
    }
    const used = this.used.get(provider) ?? 0;
    if (used >= limit) return false;
    this.used.set(provider, used + 1);
    return true;
  }
}
