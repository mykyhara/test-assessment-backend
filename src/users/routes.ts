import { Router } from 'express';
import { z } from 'zod';
import type { LruCache } from '../lib/lru-cache';
import { UserStore, type User } from './store';

const newUserSchema = z.object({
  name: z.string({ error: 'name is required' }).trim().min(1, 'name is required'),
  email: z.email('a valid email is required'),
});

export function usersRouter(store: UserStore, cache: LruCache<number, User>): Router {
  const router = Router();

  router.get('/:id', async (req, res) => {
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

  router.post('/', (req, res) => {
    const parsed = newUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }

    const user = store.create(parsed.data);
    cache.set(user.id, user);
    res.status(201).json(user);
  });

  return router;
}
