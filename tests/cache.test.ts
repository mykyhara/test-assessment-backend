import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LruCache } from '../src/lib/lru-cache';

describe('LruCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('evicts the least recently used entry past capacity', () => {
    const cache = new LruCache<number, string>(2, 1000);
    cache.set(1, 'a');
    cache.set(2, 'b');
    cache.get(1);
    cache.set(3, 'c');
    expect(cache.get(2)).toBeUndefined();
    expect(cache.get(1)).toBe('a');
    expect(cache.get(3)).toBe('c');
  });

  it('expires entries after the ttl', () => {
    const cache = new LruCache<number, string>(10, 1000);
    cache.set(1, 'a');
    expect(cache.get(1)).toBe('a');
    vi.advanceTimersByTime(1001);
    expect(cache.get(1)).toBeUndefined();
  });

  it('tracks hits, misses and size', () => {
    const cache = new LruCache<number, string>(10, 1000);
    cache.set(1, 'a');
    cache.get(1);
    cache.get(2);
    expect(cache.stats).toEqual({ hits: 1, misses: 1, size: 1 });
  });

  it('prunes expired entries', () => {
    const cache = new LruCache<number, string>(10, 1000);
    cache.set(1, 'a');
    cache.set(2, 'b');
    vi.advanceTimersByTime(1001);
    expect(cache.prune()).toBe(2);
    expect(cache.stats.size).toBe(0);
  });
});
