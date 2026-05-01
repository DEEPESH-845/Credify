import { Request, Response, NextFunction } from "express";

export interface RateLimiterOptions {
  /** Maximum number of requests allowed within the time window */
  maxRequests: number;
  /** Time window duration in milliseconds */
  windowMs: number;
}

interface RequestRecord {
  timestamps: number[];
}

/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per IP address and rejects requests that exceed
 * the configured maximum within the sliding time window. Expired timestamps
 * are pruned on each request to keep memory bounded.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { maxRequests, windowMs } = options;
  const clients: Map<string, RequestRecord> = new Map();

  // Periodically clean up stale entries to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of clients.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        clients.delete(key);
      }
    }
  }, windowMs);

  // Allow the timer to not block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  function middleware(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    let record = clients.get(key);
    if (!record) {
      record = { timestamps: [] };
      clients.set(key, record);
    }

    // Sliding window: remove timestamps outside the current window
    record.timestamps = record.timestamps.filter((ts) => now - ts >= 0 && now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          details: {},
        },
      });
      return;
    }

    record.timestamps.push(now);
    next();
  }

  /** Clears all tracked clients. Useful for testing. */
  middleware.reset = () => {
    clients.clear();
  };

  /** Stops the background cleanup interval. */
  middleware.destroy = () => {
    clearInterval(cleanupInterval);
    clients.clear();
  };

  /** Exposes the internal client map for testing. */
  middleware._clients = clients;

  return middleware;
}

/** Default rate limiter for auth endpoints: 10 requests per 15-minute window */
export const authRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});

/** Global rate limiter: 100 requests per minute per IP */
export const globalRateLimiter = createRateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
});

/** Upload rate limiter: 10 uploads per 15 minutes per IP */
export const uploadRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
});
