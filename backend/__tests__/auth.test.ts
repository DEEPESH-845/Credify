import express, { Express } from "express";
import request from "supertest";
import { sanitizeMiddleware } from "../src/middleware/sanitize";
import { authRateLimiter } from "../src/middleware/rateLimiter";
import authRoutes from "../src/routes/auth";
import * as nonceRepository from "../src/repositories/nonceRepository";

// Mock the nonce repository to avoid needing a real database
jest.mock("../src/repositories/nonceRepository");

const mockedNonceRepo = nonceRepository as jest.Mocked<typeof nonceRepository>;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMiddleware);
  app.use("/api/auth", authRoutes);
  return app;
}

describe("POST /api/auth/nonce", () => {
  let app: Express;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();

    // Default mock: successfully store nonce
    mockedNonceRepo.create.mockResolvedValue({
      id: 1,
      wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      nonce: "mocknonce",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    });
  });

  it("should return a nonce for a valid Ethereum address", async () => {
    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("nonce");
    expect(typeof res.body.nonce).toBe("string");
    expect(res.body.nonce.length).toBe(64); // 32 bytes hex = 64 chars
  });

  it("should store the nonce in the repository with an expiration", async () => {
    await request(app)
      .post("/api/auth/nonce")
      .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });

    expect(mockedNonceRepo.create).toHaveBeenCalledTimes(1);
    const [walletAddress, nonce, expiresAt] = mockedNonceRepo.create.mock.calls[0];
    expect(walletAddress).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBe(64);
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("should lowercase the wallet address before storing", async () => {
    await request(app)
      .post("/api/auth/nonce")
      .send({ address: "0x1234567890ABCDEF1234567890ABCDEF12345678" });

    expect(mockedNonceRepo.create).toHaveBeenCalledTimes(1);
    const [walletAddress] = mockedNonceRepo.create.mock.calls[0];
    expect(walletAddress).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  it("should return 400 for missing address", async () => {
    const res = await request(app).post("/api/auth/nonce").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toHaveProperty("address");
  });

  it("should return 400 for invalid Ethereum address", async () => {
    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "not-an-address" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for address without 0x prefix", async () => {
    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "1234567890abcdef1234567890abcdef12345678" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for address with wrong length", async () => {
    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "0x1234" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 500 when repository throws an error", async () => {
    mockedNonceRepo.create.mockRejectedValue(new Error("DB connection failed"));

    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("should generate unique nonces for each request", async () => {
    const nonces: string[] = [];

    mockedNonceRepo.create.mockImplementation(async (_addr, nonce, _exp) => ({
      id: 1,
      wallet_address: _addr,
      nonce,
      created_at: new Date(),
      expires_at: _exp,
    }));

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/nonce")
        .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });

      expect(res.status).toBe(200);
      nonces.push(res.body.nonce);
    }

    // All nonces should be unique
    const uniqueNonces = new Set(nonces);
    expect(uniqueNonces.size).toBe(5);
  });
});

describe("POST /api/auth/nonce with rate limiting", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(sanitizeMiddleware);
    authRateLimiter.reset();
    app.use("/api/auth", authRateLimiter, authRoutes);
    jest.clearAllMocks();

    mockedNonceRepo.create.mockResolvedValue({
      id: 1,
      wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      nonce: "mocknonce",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    });
  });

  it("should apply rate limiting to auth routes", async () => {
    // The default rate limiter allows 10 requests per 15 minutes
    // Send 11 requests and verify the 11th is rate limited
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/auth/nonce")
        .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });
      expect(res.status).toBe(200);
    }

    const res = await request(app)
      .post("/api/auth/nonce")
      .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
