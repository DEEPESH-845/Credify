import express, { Express } from "express";
import request from "supertest";
import { ethers } from "ethers";
import { sanitizeMiddleware } from "../src/middleware/sanitize";
import { authRateLimiter } from "../src/middleware/rateLimiter";
import authRoutes from "../src/routes/auth";
import * as nonceRepository from "../src/repositories/nonceRepository";
import * as userRepository from "../src/repositories/userRepository";

// Mock the nonce repository to avoid needing a real database
jest.mock("../src/repositories/nonceRepository");
jest.mock("../src/repositories/userRepository");

const mockedNonceRepo = nonceRepository as jest.Mocked<typeof nonceRepository>;
const mockedUserRepo = userRepository as jest.Mocked<typeof userRepository>;

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

describe("POST /api/auth/verify", () => {
  let app: Express;
  let wallet: ethers.HDNodeWallet;
  const testNonce = "a".repeat(64);

  beforeAll(() => {
    wallet = ethers.Wallet.createRandom();
  });

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();

    // Default: user does not exist yet
    mockedUserRepo.findByAddress.mockResolvedValue(null);
    mockedUserRepo.create.mockResolvedValue({
      id: 1,
      wallet_address: wallet.address.toLowerCase(),
      display_name: null,
      headline: null,
      bio: null,
      location: null,
      profile_image_cid: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  function mockValidNonce(address: string, nonce: string) {
    mockedNonceRepo.findByAddressAndNonce.mockResolvedValue({
      id: 1,
      wallet_address: address.toLowerCase(),
      nonce,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    });
    mockedNonceRepo.deleteById.mockResolvedValue(undefined);
  }

  function mockExpiredNonce(address: string, nonce: string) {
    mockedNonceRepo.findByAddressAndNonce.mockResolvedValue({
      id: 1,
      wallet_address: address.toLowerCase(),
      nonce,
      created_at: new Date(Date.now() - 10 * 60 * 1000),
      expires_at: new Date(Date.now() - 5 * 60 * 1000), // expired 5 min ago
    });
    mockedNonceRepo.deleteById.mockResolvedValue(undefined);
  }

  it("should return a JWT for a valid signature", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockValidNonce(address, testNonce);

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.address).toBe(address.toLowerCase());
  });

  it("should invalidate the nonce after successful verification", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockValidNonce(address, testNonce);

    await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(mockedNonceRepo.deleteById).toHaveBeenCalledWith(1);
  });

  it("should create a user profile on first-time authentication", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockValidNonce(address, testNonce);
    mockedUserRepo.findByAddress.mockResolvedValue(null);

    await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(mockedUserRepo.create).toHaveBeenCalledWith(address.toLowerCase());
  });

  it("should not create a user profile if user already exists", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockValidNonce(address, testNonce);
    mockedUserRepo.findByAddress.mockResolvedValue({
      id: 1,
      wallet_address: address.toLowerCase(),
      display_name: "Existing User",
      headline: null,
      bio: null,
      location: null,
      profile_image_cid: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(mockedUserRepo.create).not.toHaveBeenCalled();
  });

  it("should return 401 when signature does not match claimed address", async () => {
    // Sign with wallet but claim a different address
    const differentAddress = "0x0000000000000000000000000000000000000001";
    const signature = await wallet.signMessage(testNonce);
    mockValidNonce(differentAddress, testNonce);

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: differentAddress, signature, nonce: testNonce });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_SIGNATURE_MISMATCH");
  });

  it("should return 401 when nonce is not found", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockedNonceRepo.findByAddressAndNonce.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_NONCE_INVALID");
  });

  it("should return 401 when nonce has expired", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockExpiredNonce(address, testNonce);

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_NONCE_INVALID");
  });

  it("should clean up expired nonce after rejection", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockExpiredNonce(address, testNonce);

    await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(mockedNonceRepo.deleteById).toHaveBeenCalledWith(1);
  });

  it("should return 400 for missing address", async () => {
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ signature: "0xabc", nonce: testNonce });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for missing signature", async () => {
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: wallet.address, nonce: testNonce });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for missing nonce", async () => {
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: wallet.address, signature: "0xabc" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for invalid Ethereum address format", async () => {
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: "not-an-address", signature: "0xabc", nonce: testNonce });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should handle case-insensitive address comparison", async () => {
    const address = wallet.address;
    const upperAddress = address.toUpperCase().replace("0X", "0x");
    const signature = await wallet.signMessage(testNonce);
    mockValidNonce(upperAddress, testNonce);

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address: upperAddress, signature, nonce: testNonce });

    expect(res.status).toBe(200);
    expect(res.body.address).toBe(address.toLowerCase());
  });

  it("should return 500 when repository throws an unexpected error", async () => {
    const address = wallet.address;
    const signature = await wallet.signMessage(testNonce);
    mockedNonceRepo.findByAddressAndNonce.mockRejectedValue(
      new Error("DB connection failed")
    );

    const res = await request(app)
      .post("/api/auth/verify")
      .send({ address, signature, nonce: testNonce });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
