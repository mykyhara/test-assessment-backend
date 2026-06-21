import { describe, it, expect, vi } from 'vitest';
import { UserStore } from '../src/users';

describe('UserStore', () => {
  it('coalesces concurrent fetches for the same id into a single read', async () => {
    const store = new UserStore(20, 4);
    const read = vi.spyOn(store as unknown as { read: (id: number) => Promise<unknown> }, 'read');

    const [a, b, c] = await Promise.all([store.fetch(1), store.fetch(1), store.fetch(1)]);

    expect(read).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ id: 1, name: 'John Doe', email: 'john@example.com' });
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('returns null for unknown users', async () => {
    const store = new UserStore(1, 4);
    await expect(store.fetch(999)).resolves.toBeNull();
  });

  it('creates users with incrementing ids', () => {
    const store = new UserStore(1, 4);
    expect(store.create({ name: 'Bob', email: 'bob@example.com' })).toEqual({
      id: 4,
      name: 'Bob',
      email: 'bob@example.com',
    });
  });
});
