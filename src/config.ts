export const config = {
  port: Number(process.env.PORT ?? 3000),
  cache: {
    maxEntries: 1000,
    ttlMs: 60 * 1000,
    sweepIntervalMs: 10 * 1000,
  },
  rateLimit: {
    sustained: { capacity: 10, windowMs: 60 * 1000 },
    burst: { capacity: 5, windowMs: 10 * 1000 },
  },
  db: {
    latencyMs: 200,
    concurrency: 4,
  },
};
