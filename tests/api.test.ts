import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const john = { id: 1, name: 'John Doe', email: 'john@example.com' };

describe('user-api', () => {
  it('serves a miss then a cache hit for the same user', async () => {
    const { app } = createApp();

    const miss = await request(app).get('/users/1');
    expect(miss.status).toBe(200);
    expect(miss.body).toEqual(john);
    expect(miss.headers['x-cache']).toBe('MISS');

    const hit = await request(app).get('/users/1');
    expect(hit.status).toBe(200);
    expect(hit.headers['x-cache']).toBe('HIT');
  });

  it('returns 404 for unknown ids and 400 for invalid ones', async () => {
    const { app } = createApp();
    expect((await request(app).get('/users/999')).status).toBe(404);
    expect((await request(app).get('/users/abc')).status).toBe(400);
    expect((await request(app).get('/users/0')).status).toBe(400);
  });

  it('creates a user and caches it', async () => {
    const { app } = createApp();

    const created = await request(app)
      .post('/users')
      .send({ name: 'Bob', email: 'bob@example.com' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Bob', email: 'bob@example.com' });

    const fetched = await request(app).get(`/users/${created.body.id}`);
    expect(fetched.headers['x-cache']).toBe('HIT');
  });

  it('rejects invalid user payloads', async () => {
    const { app } = createApp();
    const res = await request(app).post('/users').send({ name: '', email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name is required');
  });

  it('clears the cache on DELETE /cache', async () => {
    const { app } = createApp();
    await request(app).get('/users/1');
    await request(app).delete('/cache').expect(204);
    const status = await request(app).get('/cache-status');
    expect(status.body.size).toBe(0);
  });

  it('reports cache and request metrics', async () => {
    const { app } = createApp();
    await request(app).get('/users/1');
    await request(app).get('/users/1');
    const status = await request(app).get('/cache-status');
    expect(status.body.hits).toBe(1);
    expect(status.body.misses).toBe(1);
    expect(status.body.requests).toBeGreaterThan(0);
    expect(typeof status.body.averageResponseTimeMs).toBe('number');
  });

  it('returns 429 once the burst limit is exceeded', async () => {
    const { app } = createApp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await request(app).get('/users/1')).status);
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);

    const limited = await request(app).get('/users/1');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.body.error).toMatch(/rate limit/i);
  });
});
