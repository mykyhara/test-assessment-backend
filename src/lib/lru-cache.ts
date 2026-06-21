interface Entry<V> {
  value: V;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

export class LruCache<K, V> {
  private readonly store = new Map<K, Entry<V>>();
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }

  startSweeper(intervalMs: number): NodeJS.Timeout {
    return setInterval(() => this.prune(), intervalMs).unref();
  }

  get stats(): CacheStats {
    return { size: this.store.size, hits: this.hits, misses: this.misses };
  }
}
