import { describe, it, expect } from 'vitest';
import { AsyncQueue } from '../src/queue';

describe('AsyncQueue', () => {
  it('never runs more tasks than the concurrency limit', async () => {
    const queue = new AsyncQueue(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      new Promise<void>((resolve) => {
        active += 1;
        peak = Math.max(peak, active);
        setTimeout(() => {
          active -= 1;
          resolve();
        }, 10);
      });

    await Promise.all(Array.from({ length: 6 }, () => queue.run(task)));
    expect(peak).toBe(2);
  });

  it('propagates results and errors', async () => {
    const queue = new AsyncQueue(1);
    await expect(queue.run(async () => 42)).resolves.toBe(42);
    await expect(
      queue.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
