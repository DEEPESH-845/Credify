import express, { Express } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { sanitizeMiddleware } from "../src/middleware/sanitize";
import { uploadRateLimiter } from "../src/middleware/rateLimiter";
import profileRoutes from "../src/routes/profiles";
import * as userRepository from "../src/repositories/userRepository";
import { User } from "../src/types/models";

// Mock the user repository to avoid needing a real database
jest.mock("../src/repositories/userRepository");

const mockedUserRepo = userRepository as jest.Mocked<typeof userRepository>;

const JWT_SECRET = "dev-secret-change-in-production";

const OWNER_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function generateToken(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET);
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    wallet_address: OWNER_ADDRESS,
    display_name: null,
    headline: null,
    bio: null,
    location: null,
    profile_image_cid: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMiddleware);
  app.use("/api/profiles", profileRoutes);
  return app;
}

describe("POST /api/profiles", () => {
  let app: Express;
  const token = generateToken(OWNER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should create a new profile for an authenticated user", async () => {
    const user = makeUser();
    mockedUserRepo.findByAddress.mockResolvedValue(null);
    mockedUserRepo.create.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({ wallet_address: OWNER_ADDRESS });

    expect(res.status).toBe(201);
    expect(res.body.wallet_address).toBe(OWNER_ADDRESS);
  });

  it("should create a profile with optional fields", async () => {
    const user = makeUser({ display_name: "Alice" });
    mockedUserRepo.findByAddress.mockResolvedValue(null);
    mockedUserRepo.create.mockResolvedValue(makeUser());
    mockedUserRepo.update.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        wallet_address: OWNER_ADDRESS,
        display_name: "Alice",
        headline: "Developer",
        bio: "I build things",
        location: "NYC",
      });

    expect(res.status).toBe(201);
  });

  it("should return existing profile if one already exists", async () => {
    const existingUser = makeUser({ display_name: "Existing" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);

    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({ wallet_address: OWNER_ADDRESS });

    expect(res.status).toBe(201);
    expect(res.body.display_name).toBe("Existing");
    expect(mockedUserRepo.create).not.toHaveBeenCalled();
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app)
      .post("/api/profiles")
      .send({ wallet_address: OWNER_ADDRESS });

    expect(res.status).toBe(401);
  });

  it("should return 400 for invalid wallet address format", async () => {
    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({ wallet_address: "not-an-address" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when display_name exceeds 100 characters", async () => {
    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        wallet_address: OWNER_ADDRESS,
        display_name: "a".repeat(101),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when headline exceeds 200 characters", async () => {
    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        wallet_address: OWNER_ADDRESS,
        headline: "a".repeat(201),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when location exceeds 100 characters", async () => {
    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        wallet_address: OWNER_ADDRESS,
        location: "a".repeat(101),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should accept display_name at exactly 100 characters", async () => {
    mockedUserRepo.findByAddress.mockResolvedValue(null);
    mockedUserRepo.create.mockResolvedValue(makeUser());
    mockedUserRepo.update.mockResolvedValue(makeUser({ display_name: "a".repeat(100) }));

    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({
        wallet_address: OWNER_ADDRESS,
        display_name: "a".repeat(100),
      });

    expect(res.status).toBe(201);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedUserRepo.findByAddress.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post("/api/profiles")
      .set("Authorization", `Bearer ${token}`)
      .send({ wallet_address: OWNER_ADDRESS });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("GET /api/profiles/:address", () => {
  let app: Express;
  const token = generateToken(OWNER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should return a profile for a valid address", async () => {
    const user = makeUser({ display_name: "Alice", headline: "Dev" });
    mockedUserRepo.findByAddress.mockResolvedValue(user);

    const res = await request(app)
      .get(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.wallet_address).toBe(OWNER_ADDRESS);
    expect(res.body.display_name).toBe("Alice");
    expect(res.body.headline).toBe("Dev");
  });

  it("should return 404 for a non-existent profile", async () => {
    mockedUserRepo.findByAddress.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/profiles/${OTHER_ADDRESS}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app).get(`/api/profiles/${OWNER_ADDRESS}`);

    expect(res.status).toBe(401);
  });

  it("should allow any authenticated user to view any profile", async () => {
    const user = makeUser({ wallet_address: OTHER_ADDRESS });
    mockedUserRepo.findByAddress.mockResolvedValue(user);

    const res = await request(app)
      .get(`/api/profiles/${OTHER_ADDRESS}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedUserRepo.findByAddress.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .get(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /api/profiles/:address", () => {
  let app: Express;
  const ownerToken = generateToken(OWNER_ADDRESS);
  const otherToken = generateToken(OTHER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should update own profile successfully", async () => {
    const existingUser = makeUser();
    const updatedUser = makeUser({ display_name: "Updated Name", headline: "New Headline" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);

    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "Updated Name", headline: "New Headline" });

    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe("Updated Name");
    expect(res.body.headline).toBe("New Headline");
  });

  it("should return 403 when trying to update another user's profile", async () => {
    const res = await request(app)
      .put(`/api/profiles/${OTHER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "Hacked Name" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 404 when profile does not exist", async () => {
    mockedUserRepo.findByAddress.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "Name" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .send({ display_name: "Name" });

    expect(res.status).toBe(401);
  });

  it("should return 400 when display_name exceeds 100 characters", async () => {
    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "a".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when headline exceeds 200 characters", async () => {
    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ headline: "a".repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when location exceeds 100 characters", async () => {
    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ location: "a".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should accept bio of any length", async () => {
    const existingUser = makeUser();
    const updatedUser = makeUser({ bio: "a".repeat(10000) });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);

    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ bio: "a".repeat(10000) });

    expect(res.status).toBe(200);
  });

  it("should handle case-insensitive address comparison for ownership", async () => {
    const upperAddress = OWNER_ADDRESS.toUpperCase().replace("0X", "0x");
    const existingUser = makeUser();
    const updatedUser = makeUser({ display_name: "Updated" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);

    const res = await request(app)
      .put(`/api/profiles/${upperAddress}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "Updated" });

    expect(res.status).toBe(200);
  });

  it("should sanitize HTML in profile fields", async () => {
    const existingUser = makeUser();
    const updatedUser = makeUser({ display_name: "alert('xss')" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);

    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "<script>alert('xss')</script>" });

    // The sanitize middleware strips script tags before the route handler
    expect(res.status).toBe(200);
    expect(mockedUserRepo.update).toHaveBeenCalled();
    const updateCall = mockedUserRepo.update.mock.calls[0];
    // The body should have been sanitized by the middleware
    expect(updateCall[1].display_name).not.toContain("<script>");
  });

  it("should return 500 when repository throws an error", async () => {
    mockedUserRepo.findByAddress.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .put(`/api/profiles/${OWNER_ADDRESS}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ display_name: "Name" });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

// --- Mock the IPFS service ---
jest.mock("../src/services/ipfsService", () => {
  const actual = jest.requireActual("../src/services/ipfsService");
  return {
    ...actual,
    uploadAndStore: jest.fn(),
    uploadToIPFS: jest.fn(),
  };
});

import * as ipfsService from "../src/services/ipfsService";

const mockedIpfsService = ipfsService as jest.Mocked<typeof ipfsService>;

describe("POST /api/profiles/:address/image", () => {
  let app: Express;
  const ownerToken = generateToken(OWNER_ADDRESS);
  const otherToken = generateToken(OTHER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
    uploadRateLimiter.reset();
  });

  it("should upload a JPEG image and return the CID", async () => {
    const existingUser = makeUser();
    const updatedUser = makeUser({ profile_image_cid: "QmFakeCid123" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);
    mockedIpfsService.uploadAndStore.mockResolvedValue("QmFakeCid123");

    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.cid).toBe("QmFakeCid123");
    expect(res.body.profile.profile_image_cid).toBe("QmFakeCid123");
    expect(mockedIpfsService.uploadAndStore).toHaveBeenCalledWith(
      expect.any(Buffer),
      "image/jpeg"
    );
    expect(mockedUserRepo.update).toHaveBeenCalledWith(
      OWNER_ADDRESS.toLowerCase(),
      { profile_image_cid: "QmFakeCid123" }
    );
  });

  it("should upload a PNG image and return the CID", async () => {
    const existingUser = makeUser();
    const updatedUser = makeUser({ profile_image_cid: "QmPngCid456" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);
    mockedIpfsService.uploadAndStore.mockResolvedValue("QmPngCid456");

    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-png-data"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.cid).toBe("QmPngCid456");
  });

  it("should return 403 when uploading to another user's profile", async () => {
    mockedIpfsService.uploadAndStore.mockResolvedValue("QmShouldNotReach");

    const res = await request(app)
      .post(`/api/profiles/${OTHER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(mockedIpfsService.uploadAndStore).not.toHaveBeenCalled();
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .attach("image", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(401);
  });

  it("should return 400 when no file is provided", async () => {
    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("No image file provided");
  });

  it("should return 415 for unsupported file type", async () => {
    mockedUserRepo.findByAddress.mockResolvedValue(makeUser());
    mockedIpfsService.uploadAndStore.mockRejectedValue(
      new ipfsService.UnsupportedFileTypeError(ipfsService.ALLOWED_IMAGE_TYPES)
    );

    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-gif-data"), {
        filename: "animation.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("should return 413 when file exceeds maximum size via IPFS service", async () => {
    mockedUserRepo.findByAddress.mockResolvedValue(makeUser());
    mockedIpfsService.uploadAndStore.mockRejectedValue(
      new ipfsService.FileTooLargeError(ipfsService.MAX_FILE_SIZE)
    );

    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("large-data"), {
        filename: "big.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("should return 404 when profile does not exist", async () => {
    mockedUserRepo.findByAddress.mockResolvedValue(null);
    mockedIpfsService.uploadAndStore.mockResolvedValue("QmShouldNotReach");

    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 500 when repository throws an unexpected error", async () => {
    mockedUserRepo.findByAddress.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post(`/api/profiles/${OWNER_ADDRESS}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("should handle case-insensitive address comparison for ownership", async () => {
    const upperAddress = OWNER_ADDRESS.toUpperCase().replace("0X", "0x");
    const existingUser = makeUser();
    const updatedUser = makeUser({ profile_image_cid: "QmCaseCid" });
    mockedUserRepo.findByAddress.mockResolvedValue(existingUser);
    mockedUserRepo.update.mockResolvedValue(updatedUser);
    mockedIpfsService.uploadAndStore.mockResolvedValue("QmCaseCid");

    const res = await request(app)
      .post(`/api/profiles/${upperAddress}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.cid).toBe("QmCaseCid");
  });
});
