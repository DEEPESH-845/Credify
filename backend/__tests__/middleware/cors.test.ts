import express, { Express } from "express";
import request from "supertest";
import { createCorsMiddleware } from "../../src/middleware/cors";

function createApp(origin?: string): Express {
  const app = express();
  app.use(
    createCorsMiddleware({
      origin: origin ?? "http://localhost:3000",
    })
  );
  app.get("/api/test", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/api/test", (_req, res) => {
    res.status(200).json({ created: true });
  });
  return app;
}

describe("CORS middleware", () => {
  describe("allowed origin", () => {
    it("should set Access-Control-Allow-Origin for matching origin", async () => {
      const app = createApp("http://localhost:3000");

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
    });

    it("should set Access-Control-Allow-Credentials to true by default", async () => {
      const app = createApp("http://localhost:3000");

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("should not set CORS headers when origin does not match", async () => {
      const app = createApp("http://localhost:3000");

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://evil.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("should not set CORS headers when no origin header is present", async () => {
      const app = createApp("http://localhost:3000");

      const res = await request(app).get("/api/test");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("preflight OPTIONS requests", () => {
    it("should respond with 204 for preflight from allowed origin", async () => {
      const app = createApp("http://localhost:3000");

      const res = await request(app)
        .options("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
      expect(res.headers["access-control-allow-methods"]).toBe(
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      expect(res.headers["access-control-allow-headers"]).toBe(
        "Content-Type, Authorization"
      );
      expect(res.headers["access-control-max-age"]).toBe("86400");
    });

    it("should not set preflight headers for non-matching origin", async () => {
      const app = createApp("http://localhost:3000");

      const res = await request(app)
        .options("/api/test")
        .set("Origin", "http://evil.com");

      // Should pass through to next handler (Express default OPTIONS handling)
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-allow-methods"]).toBeUndefined();
    });
  });

  describe("configurable origin", () => {
    it("should accept a custom origin", async () => {
      const app = createApp("https://myapp.example.com");

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://myapp.example.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://myapp.example.com"
      );
    });

    it("should reject requests from other origins when custom origin is set", async () => {
      const app = createApp("https://myapp.example.com");

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("custom options", () => {
    it("should allow custom methods", async () => {
      const app = express();
      app.use(
        createCorsMiddleware({
          origin: "http://localhost:3000",
          methods: ["GET", "POST"],
        })
      );
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .options("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-methods"]).toBe("GET, POST");
    });

    it("should allow custom headers", async () => {
      const app = express();
      app.use(
        createCorsMiddleware({
          origin: "http://localhost:3000",
          allowedHeaders: ["Content-Type", "X-Custom-Header"],
        })
      );
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .options("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-headers"]).toBe(
        "Content-Type, X-Custom-Header"
      );
    });

    it("should respect credentials option set to false", async () => {
      const app = express();
      app.use(
        createCorsMiddleware({
          origin: "http://localhost:3000",
          credentials: false,
        })
      );
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("should respect custom maxAge", async () => {
      const app = express();
      app.use(
        createCorsMiddleware({
          origin: "http://localhost:3000",
          maxAge: 3600,
        })
      );
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .options("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-max-age"]).toBe("3600");
    });
  });

  describe("environment variable fallback", () => {
    const originalEnv = process.env.FRONTEND_ORIGIN;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.FRONTEND_ORIGIN = originalEnv;
      } else {
        delete process.env.FRONTEND_ORIGIN;
      }
    });

    it("should use FRONTEND_ORIGIN env var when no origin option is provided", async () => {
      process.env.FRONTEND_ORIGIN = "https://prod.example.com";

      const app = express();
      app.use(createCorsMiddleware());
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "https://prod.example.com");

      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://prod.example.com"
      );
    });

    it("should default to http://localhost:3000 when no env var or option is set", async () => {
      delete process.env.FRONTEND_ORIGIN;

      const app = express();
      app.use(createCorsMiddleware());
      app.get("/api/test", (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
    });
  });
});
