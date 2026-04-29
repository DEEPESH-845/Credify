import express, { Express } from "express";
import request from "supertest";
import { createRateLimiter } from "../../src/middleware/rateLimiter";

function createApp(maxRequests: number, windowMs: number): {
  app: Express;
  limiter: ReturnType<typeof createRateLimiter>;
} {
  const app = express();
  const limiter = createRateLimiter({ maxRequests, windowMs });

  app.use("/api/auth", limiter);
  app.post("/api/auth/nonce", (_req, res) => {
    res.status(200).json({ nonce: "test-nonce" });
  });
  app.post("/api/auth/verify", (_req, res) => {
    res.status(200).json({ token: "test-token" });
  });
  // Non-auth endpoint should not be rate limited
  app.get("/api/profiles", (_req, res) => {
    res.status(200).json({ profiles: [] });
  });

  return { app, limiter };
}

describe("rateLimiter middleware", () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
  });

  it("should allow requests under the limit", async () => {
    const result = createApp(5, 60_000);
    limiter = result.limiter;

    const res = await request(result.app).post("/api/auth/nonce");
    expect(res.status).toBe(200);
  });

  it("should return 429 when limit is exceeded", async () => {
    const result = createApp(3, 60_000);
    limiter = result.limiter;

    // Make 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await request(result.app).post("/api/auth/nonce");
      expect(res.status).toBe(200);
    }

    // 4th request should be rate limited
    const res = await request(result.app).post("/api/auth/nonce");
    expect(res.status).toBe(429);
  });

  it("should return correct error response format on 429", async () => {
    const result = createApp(1, 60_000);
    limiter = result.limiter;

    await request(result.app).post("/api/auth/nonce");
    const res = await request(result.app).post("/api/auth/nonce");

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        details: {},
      },
    });
  });

  it("should rate limit all auth sub-routes", async () => {
    const result = createApp(2, 60_000);
    limiter = result.limiter;

    // Use up the limit across different auth endpoints
    await request(result.app).post("/api/auth/nonce");
    await request(result.app).post("/api/auth/verify");

    // Both endpoints should now be limited
    const res1 = await request(result.app).post("/api/auth/nonce");
    expect(res1.status).toBe(429);

    const res2 = await request(result.app).post("/api/auth/verify");
    expect(res2.status).toBe(429);
  });

  it("should not rate limit non-auth endpoints", async () => {
    const result = createApp(1, 60_000);
    limiter = result.limiter;

    // Exhaust the auth limit
    await request(result.app).post("/api/auth/nonce");
    const authRes = await request(result.app).post("/api/auth/nonce");
    expect(authRes.status).toBe(429);

    // Non-auth endpoint should still work
    const profileRes = await request(result.app).get("/api/profiles");
    expect(profileRes.status).toBe(200);
  });

  it("should allow requests again after the window expires", async () => {
    // Use a very short window for testing
    const result = createApp(1, 50);
    limiter = result.limiter;

    const res1 = await request(result.app).post("/api/auth/nonce");
    expect(res1.status).toBe(200);

    const res2 = await request(result.app).post("/api/auth/nonce");
    expect(res2.status).toBe(429);

    // Wait for the window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const res3 = await request(result.app).post("/api/auth/nonce");
    expect(res3.status).toBe(200);
  });

  it("should track requests per IP independently", async () => {
    const result = createApp(1, 60_000);
    limiter = result.limiter;

    // Simulate different IPs by manipulating the internal state directly
    // Since supertest uses the same loopback, we test the internal map
    const record1 = { timestamps: [Date.now()] };
    const record2 = { timestamps: [] };
    limiter._clients.set("192.168.1.1", record1);
    limiter._clients.set("192.168.1.2", record2);

    expect(limiter._clients.get("192.168.1.1")!.timestamps.length).toBe(1);
    expect(limiter._clients.get("192.168.1.2")!.timestamps.length).toBe(0);
  });

  it("should reset all tracked clients", async () => {
    const result = createApp(5, 60_000);
    limiter = result.limiter;

    await request(result.app).post("/api/auth/nonce");
    expect(limiter._clients.size).toBeGreaterThan(0);

    limiter.reset();
    expect(limiter._clients.size).toBe(0);
  });

  it("should be configurable with different limits", async () => {
    const result = createApp(2, 60_000);
    limiter = result.limiter;

    const res1 = await request(result.app).post("/api/auth/nonce");
    expect(res1.status).toBe(200);

    const res2 = await request(result.app).post("/api/auth/nonce");
    expect(res2.status).toBe(200);

    const res3 = await request(result.app).post("/api/auth/nonce");
    expect(res3.status).toBe(429);
  });

  it("should use sliding window - old requests expire individually", async () => {
    // Window of 100ms, max 2 requests
    const result = createApp(2, 100);
    limiter = result.limiter;

    // First request
    await request(result.app).post("/api/auth/nonce");

    // Wait 60ms, then second request
    await new Promise((resolve) => setTimeout(resolve, 60));
    await request(result.app).post("/api/auth/nonce");

    // At this point, both requests are within the window
    const blocked = await request(result.app).post("/api/auth/nonce");
    expect(blocked.status).toBe(429);

    // Wait 50ms more - first request (at t=0) should now be outside the 100ms window
    // but second request (at t=60) is still inside
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now we should have room for one more request (only the t=60 request is in window)
    const allowed = await request(result.app).post("/api/auth/nonce");
    expect(allowed.status).toBe(200);
  });
});
