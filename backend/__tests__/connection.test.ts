import express, { Express } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { sanitizeMiddleware } from "../src/middleware/sanitize";
import connectionRoutes from "../src/routes/connections";
import * as connectionRepository from "../src/repositories/connectionRepository";
import * as userRepository from "../src/repositories/userRepository";
import { Connection, User } from "../src/types/models";

// Mock repositories to avoid needing a real database
jest.mock("../src/repositories/connectionRepository");
jest.mock("../src/repositories/userRepository");

const mockedConnRepo = connectionRepository as jest.Mocked<typeof connectionRepository>;
const mockedUserRepo = userRepository as jest.Mocked<typeof userRepository>;

const JWT_SECRET = "dev-secret-change-in-production";

const REQUESTER_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const RECIPIENT_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const THIRD_ADDRESS = "0x9999999999999999999999999999999999999999";

function generateToken(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET);
}

function makeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: 1,
    requester_address: REQUESTER_ADDRESS.toLowerCase(),
    recipient_address: RECIPIENT_ADDRESS.toLowerCase(),
    status: "pending",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    wallet_address: REQUESTER_ADDRESS.toLowerCase(),
    display_name: "Test User",
    headline: "Developer",
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
  app.use("/api/connections", connectionRoutes);
  return app;
}

describe("POST /api/connections/request", () => {
  let app: Express;
  const requesterToken = generateToken(REQUESTER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should create a pending connection request", async () => {
    const connection = makeConnection();
    mockedConnRepo.findExisting.mockResolvedValue(null);
    mockedConnRepo.create.mockResolvedValue(connection);

    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ recipient_address: RECIPIENT_ADDRESS });

    expect(res.status).toBe(201);
    expect(res.body.requester_address).toBe(REQUESTER_ADDRESS.toLowerCase());
    expect(res.body.recipient_address).toBe(RECIPIENT_ADDRESS.toLowerCase());
    expect(res.body.status).toBe("pending");
  });

  it("should return 409 for duplicate connection request", async () => {
    const existing = makeConnection();
    mockedConnRepo.findExisting.mockResolvedValue(existing);

    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ recipient_address: RECIPIENT_ADDRESS });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_CONNECTION");
  });

  it("should return 409 when reverse connection already exists", async () => {
    const existing = makeConnection({
      requester_address: RECIPIENT_ADDRESS.toLowerCase(),
      recipient_address: REQUESTER_ADDRESS.toLowerCase(),
    });
    mockedConnRepo.findExisting.mockResolvedValue(existing);

    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ recipient_address: RECIPIENT_ADDRESS });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_CONNECTION");
  });

  it("should return 400 when sending request to yourself", async () => {
    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ recipient_address: REQUESTER_ADDRESS });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app)
      .post("/api/connections/request")
      .send({ recipient_address: RECIPIENT_ADDRESS });

    expect(res.status).toBe(401);
  });

  it("should return 400 for invalid recipient address format", async () => {
    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ recipient_address: "not-an-address" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when recipient_address is missing", async () => {
    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 500 when repository throws an error", async () => {
    mockedConnRepo.findExisting.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post("/api/connections/request")
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ recipient_address: RECIPIENT_ADDRESS });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /api/connections/:id/accept", () => {
  let app: Express;
  const recipientToken = generateToken(RECIPIENT_ADDRESS);
  const requesterToken = generateToken(REQUESTER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should accept a pending connection request as the recipient", async () => {
    const pending = makeConnection({ status: "pending" });
    const accepted = makeConnection({ status: "accepted" });
    mockedConnRepo.findById.mockResolvedValue(pending);
    mockedConnRepo.updateStatus.mockResolvedValue(accepted);

    const res = await request(app)
      .put("/api/connections/1/accept")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(mockedConnRepo.updateStatus).toHaveBeenCalledWith(1, "accepted");
  });

  it("should return 403 when the requester tries to accept", async () => {
    const pending = makeConnection({ status: "pending" });
    mockedConnRepo.findById.mockResolvedValue(pending);

    const res = await request(app)
      .put("/api/connections/1/accept")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 403 when a third party tries to accept", async () => {
    const thirdToken = generateToken(THIRD_ADDRESS);
    const pending = makeConnection({ status: "pending" });
    mockedConnRepo.findById.mockResolvedValue(pending);

    const res = await request(app)
      .put("/api/connections/1/accept")
      .set("Authorization", `Bearer ${thirdToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 404 for non-existent connection", async () => {
    mockedConnRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/connections/999/accept")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 when connection is already accepted", async () => {
    const accepted = makeConnection({ status: "accepted" });
    mockedConnRepo.findById.mockResolvedValue(accepted);

    const res = await request(app)
      .put("/api/connections/1/accept")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 when connection is already declined", async () => {
    const declined = makeConnection({ status: "declined" });
    mockedConnRepo.findById.mockResolvedValue(declined);

    const res = await request(app)
      .put("/api/connections/1/accept")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for invalid connection ID", async () => {
    const res = await request(app)
      .put("/api/connections/abc/accept")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app).put("/api/connections/1/accept");

    expect(res.status).toBe(401);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedConnRepo.findById.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .put("/api/connections/1/accept")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /api/connections/:id/decline", () => {
  let app: Express;
  const recipientToken = generateToken(RECIPIENT_ADDRESS);
  const requesterToken = generateToken(REQUESTER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should decline a pending connection request as the recipient", async () => {
    const pending = makeConnection({ status: "pending" });
    const declined = makeConnection({ status: "declined" });
    mockedConnRepo.findById.mockResolvedValue(pending);
    mockedConnRepo.updateStatus.mockResolvedValue(declined);

    const res = await request(app)
      .put("/api/connections/1/decline")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("declined");
    expect(mockedConnRepo.updateStatus).toHaveBeenCalledWith(1, "declined");
  });

  it("should return 403 when the requester tries to decline", async () => {
    const pending = makeConnection({ status: "pending" });
    mockedConnRepo.findById.mockResolvedValue(pending);

    const res = await request(app)
      .put("/api/connections/1/decline")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 403 when a third party tries to decline", async () => {
    const thirdToken = generateToken(THIRD_ADDRESS);
    const pending = makeConnection({ status: "pending" });
    mockedConnRepo.findById.mockResolvedValue(pending);

    const res = await request(app)
      .put("/api/connections/1/decline")
      .set("Authorization", `Bearer ${thirdToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 404 for non-existent connection", async () => {
    mockedConnRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/connections/999/decline")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 when connection is already accepted", async () => {
    const accepted = makeConnection({ status: "accepted" });
    mockedConnRepo.findById.mockResolvedValue(accepted);

    const res = await request(app)
      .put("/api/connections/1/decline")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for invalid connection ID", async () => {
    const res = await request(app)
      .put("/api/connections/abc/decline")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app).put("/api/connections/1/decline");

    expect(res.status).toBe(401);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedConnRepo.findById.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .put("/api/connections/1/decline")
      .set("Authorization", `Bearer ${recipientToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("GET /api/connections", () => {
  let app: Express;
  const requesterToken = generateToken(REQUESTER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should return paginated accepted connections with profile summaries", async () => {
    const connections = [
      makeConnection({ id: 1, status: "accepted" }),
      makeConnection({ id: 2, status: "accepted", recipient_address: THIRD_ADDRESS.toLowerCase() }),
    ];
    mockedConnRepo.findByUser.mockResolvedValue({ connections, total: 2 });
    mockedUserRepo.findByAddress.mockImplementation(async (addr) => {
      if (addr === RECIPIENT_ADDRESS.toLowerCase()) {
        return makeUser({
          wallet_address: RECIPIENT_ADDRESS.toLowerCase(),
          display_name: "Recipient",
          headline: "Engineer",
        });
      }
      if (addr === THIRD_ADDRESS.toLowerCase()) {
        return makeUser({
          wallet_address: THIRD_ADDRESS.toLowerCase(),
          display_name: "Third User",
          headline: "Designer",
        });
      }
      return null;
    });

    const res = await request(app)
      .get("/api/connections")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.connections).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.connections[0].profile.display_name).toBe("Recipient");
    expect(res.body.connections[1].profile.display_name).toBe("Third User");
  });

  it("should return empty list when user has no connections", async () => {
    mockedConnRepo.findByUser.mockResolvedValue({ connections: [], total: 0 });

    const res = await request(app)
      .get("/api/connections")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.connections).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("should accept custom page and limit query params", async () => {
    mockedConnRepo.findByUser.mockResolvedValue({ connections: [], total: 0 });

    const res = await request(app)
      .get("/api/connections?page=2&limit=5")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(5);
    expect(mockedConnRepo.findByUser).toHaveBeenCalledWith(
      REQUESTER_ADDRESS.toLowerCase(),
      2,
      5
    );
  });

  it("should use default pagination when no query params provided", async () => {
    mockedConnRepo.findByUser.mockResolvedValue({ connections: [], total: 0 });

    await request(app)
      .get("/api/connections")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(mockedConnRepo.findByUser).toHaveBeenCalledWith(
      REQUESTER_ADDRESS.toLowerCase(),
      1,
      20
    );
  });

  it("should return 400 for invalid page parameter", async () => {
    const res = await request(app)
      .get("/api/connections?page=-1")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for limit exceeding maximum", async () => {
    const res = await request(app)
      .get("/api/connections?limit=101")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app).get("/api/connections");

    expect(res.status).toBe(401);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedConnRepo.findByUser.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .get("/api/connections")
      .set("Authorization", `Bearer ${requesterToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
