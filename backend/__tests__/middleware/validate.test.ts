import express, { Express } from "express";
import request from "supertest";
import { z } from "zod";
import { validate, validateQuery } from "../../src/middleware/validate";
import {
  nonceRequestSchema,
  verifyRequestSchema,
  createProfileSchema,
  updateProfileSchema,
  connectionRequestSchema,
  createPostSchema,
  paginationQuerySchema,
} from "../../src/validators/schemas";

function createApp(schema: z.ZodSchema, type: "body" | "query" = "body"): Express {
  const app = express();
  app.use(express.json());

  if (type === "body") {
    app.post("/test", validate(schema), (_req, res) => {
      res.status(200).json({ success: true, data: _req.body });
    });
  } else {
    app.get("/test", validateQuery(schema), (_req, res) => {
      res.status(200).json({ success: true, data: (_req as any).validatedQuery });
    });
  }

  return app;
}

describe("validate middleware", () => {
  describe("error response format", () => {
    it("should return 400 with VALIDATION_ERROR code on failure", async () => {
      const app = createApp(nonceRequestSchema);

      const res = await request(app).post("/test").send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toBe("Request validation failed");
      expect(res.body.error.details).toBeDefined();
    });

    it("should include field-level error details", async () => {
      const app = createApp(nonceRequestSchema);

      const res = await request(app).post("/test").send({});

      expect(res.body.error.details).toHaveProperty("address");
    });
  });

  describe("nonceRequestSchema", () => {
    const app = createApp(nonceRequestSchema);

    it("should accept a valid Ethereum address", async () => {
      const res = await request(app)
        .post("/test")
        .send({ address: "0x1234567890abcdef1234567890abcdef12345678" });

      expect(res.status).toBe(200);
    });

    it("should reject a missing address", async () => {
      const res = await request(app).post("/test").send({});

      expect(res.status).toBe(400);
      expect(res.body.error.details.address).toBeDefined();
    });

    it("should reject an invalid Ethereum address", async () => {
      const res = await request(app)
        .post("/test")
        .send({ address: "not-an-address" });

      expect(res.status).toBe(400);
    });

    it("should reject an address without 0x prefix", async () => {
      const res = await request(app)
        .post("/test")
        .send({ address: "1234567890abcdef1234567890abcdef12345678" });

      expect(res.status).toBe(400);
    });
  });

  describe("verifyRequestSchema", () => {
    const app = createApp(verifyRequestSchema);

    it("should accept valid verify request", async () => {
      const res = await request(app).post("/test").send({
        address: "0x1234567890abcdef1234567890abcdef12345678",
        signature: "0xsomesignature",
        nonce: "abc123",
      });

      expect(res.status).toBe(200);
    });

    it("should reject missing signature", async () => {
      const res = await request(app).post("/test").send({
        address: "0x1234567890abcdef1234567890abcdef12345678",
        nonce: "abc123",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.details.signature).toBeDefined();
    });

    it("should reject empty nonce", async () => {
      const res = await request(app).post("/test").send({
        address: "0x1234567890abcdef1234567890abcdef12345678",
        signature: "0xsig",
        nonce: "",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("createProfileSchema", () => {
    const app = createApp(createProfileSchema);

    it("should accept valid profile with all fields", async () => {
      const res = await request(app).post("/test").send({
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        display_name: "Alice",
        headline: "Blockchain Developer",
        bio: "I build things.",
        location: "New York",
      });

      expect(res.status).toBe(200);
    });

    it("should accept profile with only wallet_address", async () => {
      const res = await request(app).post("/test").send({
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      });

      expect(res.status).toBe(200);
    });

    it("should reject display_name exceeding 100 characters", async () => {
      const res = await request(app).post("/test").send({
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        display_name: "a".repeat(101),
      });

      expect(res.status).toBe(400);
      expect(res.body.error.details.display_name).toBeDefined();
    });

    it("should reject headline exceeding 200 characters", async () => {
      const res = await request(app).post("/test").send({
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        headline: "a".repeat(201),
      });

      expect(res.status).toBe(400);
    });

    it("should reject location exceeding 100 characters", async () => {
      const res = await request(app).post("/test").send({
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        location: "a".repeat(101),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("updateProfileSchema", () => {
    const app = createApp(updateProfileSchema);

    it("should accept valid partial update", async () => {
      const res = await request(app).post("/test").send({
        display_name: "Bob",
      });

      expect(res.status).toBe(200);
    });

    it("should accept empty body (no fields to update)", async () => {
      const res = await request(app).post("/test").send({});

      expect(res.status).toBe(200);
    });

    it("should reject display_name exceeding 100 characters", async () => {
      const res = await request(app).post("/test").send({
        display_name: "a".repeat(101),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("connectionRequestSchema", () => {
    const app = createApp(connectionRequestSchema);

    it("should accept valid connection request", async () => {
      const res = await request(app).post("/test").send({
        recipient_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      });

      expect(res.status).toBe(200);
    });

    it("should reject missing recipient_address", async () => {
      const res = await request(app).post("/test").send({});

      expect(res.status).toBe(400);
    });

    it("should reject invalid recipient_address", async () => {
      const res = await request(app).post("/test").send({
        recipient_address: "invalid",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("createPostSchema", () => {
    const app = createApp(createPostSchema);

    it("should accept valid post content", async () => {
      const res = await request(app).post("/test").send({
        content: "Hello, blockchain world!",
      });

      expect(res.status).toBe(200);
    });

    it("should accept post at max length (5000 chars)", async () => {
      const res = await request(app).post("/test").send({
        content: "a".repeat(5000),
      });

      expect(res.status).toBe(200);
    });

    it("should reject empty content", async () => {
      const res = await request(app).post("/test").send({
        content: "",
      });

      expect(res.status).toBe(400);
    });

    it("should reject content exceeding 5000 characters", async () => {
      const res = await request(app).post("/test").send({
        content: "a".repeat(5001),
      });

      expect(res.status).toBe(400);
    });

    it("should reject missing content field", async () => {
      const res = await request(app).post("/test").send({});

      expect(res.status).toBe(400);
    });
  });
});

describe("validateQuery middleware", () => {
  describe("paginationQuerySchema", () => {
    const app = createApp(paginationQuerySchema, "query");

    it("should accept valid pagination params", async () => {
      const res = await request(app).get("/test?page=2&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ page: 2, limit: 10 });
    });

    it("should apply defaults when no params provided", async () => {
      const res = await request(app).get("/test");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ page: 1, limit: 20 });
    });

    it("should reject non-positive page", async () => {
      const res = await request(app).get("/test?page=0");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should reject limit exceeding 100", async () => {
      const res = await request(app).get("/test?limit=101");

      expect(res.status).toBe(400);
    });
  });
});
