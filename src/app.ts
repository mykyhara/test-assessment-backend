import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config';
import { LruCache } from './cache';
import { UserStore, type User } from './users';
import { Metrics, requestTimer } from './metrics';
import { rateLimit } from './rateLimit';

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

  app.use('/users', rateLimit(config.rateLimit.sustained, config.rateLimit.burst));

  app.get('/users/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: 'User id must be a positive integer.' });
      return;
    }

    const cached = cache.get(id);
    if (cached) {
      res.set('X-Cache', 'HIT').json(cached);
      return;
    }

    const user = await store.fetch(id);
    if (!user) {
      res.status(404).json({ error: `User ${id} was not found.` });
      return;
    }

    cache.set(id, user);
    res.set('X-Cache', 'MISS').json(user);
  });

  app.post('/users', (req, res) => {
    const { name, email } = req.body ?? {};
    const errors: string[] = [];
    if (typeof name !== 'string' || name.trim() === '') errors.push('name is required');
    if (typeof email !== 'string' || !isEmail(email)) errors.push('a valid email is required');
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    const user = store.create({ name: name.trim(), email: email.trim() });
    cache.set(user.id, user);
    res.status(201).json(user);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  };
  app.use(onError);

  return { app, cache, store, metrics };
}
