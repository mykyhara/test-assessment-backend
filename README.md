# Short Intro
Hi Muhammad,
Thanks for the challenge — really enjoyed it! I've put my full solution together in a Notion doc here:
https://brief-capacity-b5e.notion.site/Mykyta-Harashchenko-Developer-Challenge-aiseo-384bdef5963f80c58ca1e475dce15724

---

# User Data API: Back-End Technical Assessment

Technical assessment showcasing a user-data API built with the Express + TypeScript stack, serving mock users behind an LRU cache, a burst-aware rate limiter, and a concurrency-limited async queue. Built to the "User Data API with Advanced Caching, Rate Limiting, and Asynchronous Processing" brief.

## Getting started

```bash
pnpm install
pnpm dev          # tsx watch, http://localhost:3000
```

```bash
pnpm test         # unit + integration tests (Vitest + Supertest)
pnpm lint         # ESLint
pnpm format       # Prettier check
pnpm typecheck    # tsc, strict mode
pnpm build        # emit dist/, then `pnpm start`
```

CI runs lint, format, typecheck, test and build on every push.

## Project structure

```
src/
  server.ts        entry point, starts the cache sweeper and listens
  app.ts           app wiring: middleware + route mounting
  config.ts        tunables (TTL, rate limits, simulated latency)
  lib/             reusable primitives: lru-cache, async-queue
  middleware/      rate-limit, request-timer, error-handlers
  users/           store (mock data + single-flight) and routes
```

## Endpoints

| Method | Path            | Description                                                              |
| ------ | --------------- | ------------------------------------------------------------------------ |
| GET    | `/users/:id`    | Returns a user. `X-Cache: HIT\|MISS`. 400 for invalid id, 404 if absent. |
| POST   | `/users`        | Creates a user (`name`, `email`), caches it, returns 201.                |
| DELETE | `/cache`        | Clears the cache (204).                                                  |
| GET    | `/cache-status` | Cache size, hits, misses, request count, errors, avg response time.      |
| GET    | `/health`       | Liveness check.                                                          |

```bash
curl localhost:3000/users/1            # ~200ms (miss), then instant (hit)
curl -X POST localhost:3000/users -H 'content-type: application/json' -d '{"name":"Bob","email":"bob@example.com"}'
curl localhost:3000/cache-status
```

## Caching

`LruCache` is a `Map`-backed LRU with a per-entry TTL of 60 seconds. `Map` preserves insertion order, so promoting an entry on read is a delete-then-set, and eviction past the capacity removes the oldest key. Hits and misses are counted as they happen, and a background sweeper (`setInterval`, unref'd so it never holds the process open) prunes expired entries every 10 seconds. Reads also drop expired entries lazily.

## Concurrent requests

A cache miss simulates a 200ms database read. Two layers handle load: requests for the same id are coalesced with a single-flight map, so concurrent callers for one id share one read and all resolve from it; and all reads pass through an `AsyncQueue` that caps how many simulated reads run at once, modelling a connection pool. The cache is only written after a miss resolves, so a cached id never triggers a read.

## Rate limiting

Each client (by IP) gets two token buckets that must both admit a request: a sustained bucket of 10 tokens that refills over 60 seconds, and a burst bucket of 5 tokens that refills over 10 seconds. Tokens are checked atomically before either is consumed, so a rejected request never spends one. Over the limit returns 429 with a `Retry-After` header.

## Metrics

A timing middleware records each response's duration and status on `finish`, feeding the averages and error count exposed by `/cache-status`.

## Tradeoffs

State is all in-process: the cache, the per-IP rate-limit buckets, and the user store live in memory, so a restart drops them and a second instance wouldn't share them. That keeps the project self-contained for the exercise; scaling out means moving the cache and buckets behind Redis and the queue onto something durable like Bull. The queue itself is a plain array with a concurrency cap. It models a connection pool but has no retries or persistence. Missing ids aren't negatively cached, so a 404 always re-checks the store rather than serve a stale absence; worth revisiting if real lookups were expensive. And metrics are process-local counters on `/cache-status` rather than a Prometheus exporter, enough to show the caching effect and error rate without pulling in a metrics stack.
