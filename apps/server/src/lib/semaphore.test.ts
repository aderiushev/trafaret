import { describe, expect, it } from 'vitest';
import { Semaphore } from './semaphore.ts';

describe('Semaphore', () => {
  it('admits up to max holders and queues the rest in order', async () => {
    const semaphore = new Semaphore(2);
    const order: string[] = [];
    const releaseA = await semaphore.acquire();
    const releaseB = await semaphore.acquire();
    const third = semaphore.acquire().then((release) => (order.push('third'), release));
    const fourth = semaphore.acquire().then((release) => (order.push('fourth'), release));
    await Promise.resolve();
    expect(order).toEqual([]);
    expect(semaphore.waiting).toBe(2);

    releaseA();
    const releaseThird = await third;
    expect(order).toEqual(['third']);
    releaseB();
    await fourth;
    expect(order).toEqual(['third', 'fourth']);
    releaseThird();
  });

  it('ignores a second release of the same permit', async () => {
    const semaphore = new Semaphore(1);
    const release = await semaphore.acquire();
    release();
    release();
    const held = await semaphore.acquire();
    let admitted = false;
    const next = semaphore.acquire().then(() => {
      admitted = true;
    });
    await Promise.resolve();
    expect(admitted).toBe(false);
    held();
    await next;
    expect(admitted).toBe(true);
  });
});
