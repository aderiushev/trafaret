/** FIFO counting semaphore. `acquire` resolves with an idempotent release function. */
export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(max: number) {
    this.available = max;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
    } else {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    return this.releaser();
  }

  get waiting(): number {
    return this.waiters.length;
  }

  private releaser(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiters.shift();
      if (next)
        next(); // hand the permit straight to the next waiter
      else this.available += 1;
    };
  }
}
