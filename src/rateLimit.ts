import type { RequestHandler } from 'express';

class TokenBucket {
  private tokens: number;
  private updatedAt = Date.now();
  private readonly refillPerMs: number;

  constructor(
    private readonly capacity: number,
    windowMs: number,
  ) {
    this.tokens = capacity;
    this.refillPerMs = capacity / windowMs;
  }

  available(now: number): boolean {
    this.refill(now);
    return this.tokens >= 1;
  }

  consume(): void {
    this.tokens -= 1;
  }

  retryAfterMs(): number {
    return Math.ceil((1 - this.tokens) / this.refillPerMs);
  }

  private refill(now: number): void {
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.updatedAt) * this.refillPerMs);
    this.updatedAt = now;
  }
}

interface BucketConfig {
  capacity: number;
  windowMs: number;
}

interface Buckets {
  sustained: TokenBucket;
  burst: TokenBucket;
}

export function rateLimit(sustained: BucketConfig, burst: BucketConfig): RequestHandler {
  const clients = new Map<string, Buckets>();

  return (req, res, next) => {
    const key = req.ip ?? 'unknown';
    let buckets = clients.get(key);
    if (!buckets) {
      buckets = {
        sustained: new TokenBucket(sustained.capacity, sustained.windowMs),
        burst: new TokenBucket(burst.capacity, burst.windowMs),
      };
      clients.set(key, buckets);
    }

    const now = Date.now();
    const burstOk = buckets.burst.available(now);
    const sustainedOk = buckets.sustained.available(now);
    if (!burstOk || !sustainedOk) {
      const retryAfterMs = Math.max(buckets.burst.retryAfterMs(), buckets.sustained.retryAfterMs());
      res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000));
      res.status(429).json({ error: 'Rate limit exceeded. Please slow down and retry shortly.' });
      return;
    }

    buckets.burst.consume();
    buckets.sustained.consume();
    next();
  };
}
