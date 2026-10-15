import type { Request, Response, NextFunction } from "express";

interface Options {
  windowMs: number;
  max: number;
  message?: string;
  key?: (req: Request) => string;
}

/** Tiny fixed-window in-memory rate limiter (single process, which this server already assumes). */
export function rateLimit(opts: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(opts.windowMs, 10_000));
  timer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.key ? opts.key(req) : req.ip || "unknown";
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: opts.message || "Too many requests, slow down" });
    }
    next();
  };
}

/** Token bucket for socket events. Returns true if the event is allowed. */
export class Bucket {
  private tokens: number;
  private last = Date.now();
  constructor(private capacity: number, private refillPerSec: number) {
    this.tokens = capacity;
  }
  take(cost = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
    this.last = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
