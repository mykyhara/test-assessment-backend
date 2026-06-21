import express from 'express';
import cors from 'cors';
import { config } from './config';
import { LruCache } from './lib/lru-cache';
import { UserStore, type User } from './users/store';
import { usersRouter } from './users/routes';
import { Metrics, requestTimer } from './middleware/request-timer';
import { rateLimit } from './middleware/rate-limit';
import { notFound, errorHandler } from './middleware/error-handlers';

export function createApp() {
  const cache = new LruCache<number, User>(config.cache.maxEntries, config.cache.ttlMs);
  const store = new UserStore(config.db.latencyMs, config.db.concurrency);
  const metrics = new Metrics();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(requestTimer(metrics));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/cache-status', (_req, res) => {
    res.json({ ...cache.stats, ...metrics.snapshot });
  });

  app.delete('/cache', (_req, res) => {
    cache.clear();
    res.status(204).end();
  });

  app.use(
    '/users',
    rateLimit(config.rateLimit.sustained, config.rateLimit.burst),
    usersRouter(store, cache),
  );

  app.use(notFound);
  app.use(errorHandler);

  return { app, cache, store, metrics };
}
