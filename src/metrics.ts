import type { RequestHandler } from 'express';
import { performance } from 'node:perf_hooks';

export class Metrics {
  private requests = 0;
  private errors = 0;
  private totalMs = 0;

  record(durationMs: number, statusCode: number): void {
    this.requests += 1;
    this.totalMs += durationMs;
    if (statusCode >= 500) this.errors += 1;
  }

  get snapshot() {
    return {
      requests: this.requests,
      errors: this.errors,
      averageResponseTimeMs: this.requests
        ? Math.round((this.totalMs / this.requests) * 100) / 100
        : 0,
    };
  }
}

export function requestTimer(metrics: Metrics): RequestHandler {
  return (_req, res, next) => {
    const start = performance.now();
    res.once('finish', () => metrics.record(performance.now() - start, res.statusCode));
    next();
  };
}
