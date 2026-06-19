export const config = {
  port: Number(process.env.PORT ?? 3000),
  cache: {
    maxEntries: 1000,
    ttlMs: 60_000,
    sweepIntervalMs: 10_000,
  },
  rateLimit: {
    sustained: { capacity: 10, windowMs: 60_000 },
    burst: { capacity: 5, windowMs: 10_000 },
  },
  db: {
    latencyMs: 200,
    concurrency: 4,
  },
};
