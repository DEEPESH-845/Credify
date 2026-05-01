import express, { Express } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import ipfsRoutes from "../src/routes/ipfs";
import {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  _clearStore,
} from "../src/services/ipfsService";

const JWT_SECRET = "dev-secret-change-in-production";
const USER_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

function generateToken(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET);
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api/ipfs", ipfsRoutes);
  return app;
}

describe("POST /api/ipfs/upload", () => {
  let app: Express;
  const token = generateToken(USER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    _clearStore();
  });

  it("should upload a JPEG file and return a CID", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.cid).toBeDefined();
    expect(typeof res.body.cid).toBe("string");
    expect(res.body.cid.startsWith("Qm")).toBe(true);
  });

  it("should upload a PNG file and return a CID", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-png-data"), {
        filename: "image.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.cid).toBeDefined();
    expect(res.body.cid.startsWith("Qm")).toBe(true);
  });

  it("should upload a PDF file and return a CID", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-pdf-data"), {
        filename: "document.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(200);
    expect(res.body.cid).toBeDefined();
    expect(res.body.cid.startsWith("Qm")).toBe(true);
  });

  it("should return 415 for unsupported file type (GIF)", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("fake-gif-data"), {
        filename: "animation.gif",
        contentType: "image/gif",
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("should return 415 for unsupported file type (text/plain)", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("hello world"), {
        filename: "readme.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .attach("file", Buffer.from("fake-jpeg-data"), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(401);
  });

  it("should return 400 when no file is provided", async () => {
    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("No file provided");
  });

  it("should return 413 when file exceeds maximum size via multer", async () => {
    // Create a buffer slightly larger than MAX_FILE_SIZE
    const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1, "x");

    const res = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", largeBuffer, {
        filename: "large.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });
});

describe("GET /api/ipfs/:cid", () => {
  let app: Express;
  const token = generateToken(USER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    _clearStore();
  });

  it("should retrieve a previously uploaded JPEG file", async () => {
    const fileContent = Buffer.from("fake-jpeg-content");

    // Upload first
    const uploadRes = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", fileContent, {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(uploadRes.status).toBe(200);
    const { cid } = uploadRes.body;

    // Retrieve
    const getRes = await request(app)
      .get(`/api/ipfs/${cid}`)
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.headers["content-type"]).toContain("image/jpeg");
    expect(Buffer.from(getRes.body).toString()).toBe(
      fileContent.toString()
    );
  });

  it("should retrieve a previously uploaded PDF file", async () => {
    const fileContent = Buffer.from("fake-pdf-content");

    const uploadRes = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", fileContent, {
        filename: "doc.pdf",
        contentType: "application/pdf",
      });

    expect(uploadRes.status).toBe(200);
    const { cid } = uploadRes.body;

    const getRes = await request(app)
      .get(`/api/ipfs/${cid}`)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(getRes.status).toBe(200);
    expect(getRes.headers["content-type"]).toContain("application/pdf");
  });

  it("should return 404 for a non-existent CID", async () => {
    const res = await request(app)
      .get("/api/ipfs/QmNonExistentCid12345678901234567890123456")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should allow unauthenticated access to retrieve files", async () => {
    const res = await request(app).get(
      "/api/ipfs/QmSomeCid12345678901234567890123456789012"
    );

    // Endpoint is public — returns 404 for non-existent CID, not 401
    expect(res.status).toBe(404);
  });
});

describe("IPFS upload and retrieve round-trip", () => {
  let app: Express;
  const token = generateToken(USER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    _clearStore();
  });

  it("should round-trip a JPEG file: upload then retrieve returns same content", async () => {
    const originalContent = Buffer.from("round-trip-jpeg-test-data");

    const uploadRes = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", originalContent, {
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

    expect(uploadRes.status).toBe(200);
    const { cid } = uploadRes.body;

    const getRes = await request(app)
      .get(`/api/ipfs/${cid}`)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(getRes.status).toBe(200);
    expect(Buffer.compare(getRes.body, originalContent)).toBe(0);
  });

  it("should return different CIDs for different file contents", async () => {
    const uploadRes1 = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("content-one"), {
        filename: "a.jpg",
        contentType: "image/jpeg",
      });

    const uploadRes2 = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("content-two"), {
        filename: "b.jpg",
        contentType: "image/jpeg",
      });

    expect(uploadRes1.status).toBe(200);
    expect(uploadRes2.status).toBe(200);
    expect(uploadRes1.body.cid).not.toBe(uploadRes2.body.cid);
  });

  it("should return the same CID for identical file contents", async () => {
    const content = Buffer.from("identical-content");

    const uploadRes1 = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", content, {
        filename: "a.jpg",
        contentType: "image/jpeg",
      });

    const uploadRes2 = await request(app)
      .post("/api/ipfs/upload")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", content, {
        filename: "b.jpg",
        contentType: "image/jpeg",
      });

    expect(uploadRes1.status).toBe(200);
    expect(uploadRes2.status).toBe(200);
    expect(uploadRes1.body.cid).toBe(uploadRes2.body.cid);
  });
});
