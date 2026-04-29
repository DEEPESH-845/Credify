import express, { Express } from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { sanitizeMiddleware } from "../src/middleware/sanitize";
import postRoutes from "../src/routes/posts";
import feedRoutes from "../src/routes/feed";
import * as postRepository from "../src/repositories/postRepository";
import { Post } from "../src/types/models";

// Mock repository to avoid needing a real database
jest.mock("../src/repositories/postRepository");

const mockedPostRepo = postRepository as jest.Mocked<typeof postRepository>;

const JWT_SECRET = "dev-secret-change-in-production";

const AUTHOR_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const OTHER_ADDRESS = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

function generateToken(address: string): string {
  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET);
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 1,
    author_address: AUTHOR_ADDRESS.toLowerCase(),
    content: "Hello, blockchain world!",
    created_at: new Date(),
    ...overrides,
  };
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMiddleware);
  app.use("/api/posts", postRoutes);
  app.use("/api/feed", feedRoutes);
  return app;
}

describe("POST /api/posts", () => {
  let app: Express;
  const authorToken = generateToken(AUTHOR_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should create a post successfully", async () => {
    const post = makePost();
    mockedPostRepo.create.mockResolvedValue(post);

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: "Hello, blockchain world!" });

    expect(res.status).toBe(201);
    expect(res.body.author_address).toBe(AUTHOR_ADDRESS.toLowerCase());
    expect(res.body.content).toBe("Hello, blockchain world!");
    expect(mockedPostRepo.create).toHaveBeenCalledWith(
      AUTHOR_ADDRESS.toLowerCase(),
      "Hello, blockchain world!"
    );
  });

  it("should return 400 for empty content", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for missing content field", async () => {
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for content exceeding 5000 characters", async () => {
    const longContent = "a".repeat(5001);

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: longContent });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should accept content at exactly 5000 characters", async () => {
    const maxContent = "a".repeat(5000);
    const post = makePost({ content: maxContent });
    mockedPostRepo.create.mockResolvedValue(post);

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: maxContent });

    expect(res.status).toBe(201);
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app)
      .post("/api/posts")
      .send({ content: "Hello" });

    expect(res.status).toBe(401);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedPostRepo.create.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: "Hello" });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /api/posts/:id", () => {
  let app: Express;
  const authorToken = generateToken(AUTHOR_ADDRESS);
  const otherToken = generateToken(OTHER_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should delete own post successfully", async () => {
    const post = makePost();
    mockedPostRepo.findById.mockResolvedValue(post);
    mockedPostRepo.deleteById.mockResolvedValue(true);

    const res = await request(app)
      .delete("/api/posts/1")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(204);
    expect(mockedPostRepo.deleteById).toHaveBeenCalledWith(1);
  });

  it("should return 403 when deleting another user's post", async () => {
    const post = makePost();
    mockedPostRepo.findById.mockResolvedValue(post);

    const res = await request(app)
      .delete("/api/posts/1")
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return 404 for non-existent post", async () => {
    mockedPostRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .delete("/api/posts/999")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("should return 400 for invalid post ID", async () => {
    const res = await request(app)
      .delete("/api/posts/abc")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app).delete("/api/posts/1");

    expect(res.status).toBe(401);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedPostRepo.findById.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .delete("/api/posts/1")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("GET /api/feed", () => {
  let app: Express;
  const authorToken = generateToken(AUTHOR_ADDRESS);

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it("should return paginated feed with default pagination", async () => {
    const posts = [
      makePost({ id: 2, created_at: new Date("2024-01-02") }),
      makePost({ id: 1, created_at: new Date("2024-01-01") }),
    ];
    mockedPostRepo.findFeed.mockResolvedValue({ posts, total: 2 });

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(mockedPostRepo.findFeed).toHaveBeenCalledWith(
      AUTHOR_ADDRESS.toLowerCase(),
      1,
      20
    );
  });

  it("should return empty feed when no posts exist", async () => {
    mockedPostRepo.findFeed.mockResolvedValue({ posts: [], total: 0 });

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("should accept custom page and limit query params", async () => {
    mockedPostRepo.findFeed.mockResolvedValue({ posts: [], total: 0 });

    const res = await request(app)
      .get("/api/feed?page=3&limit=10")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.limit).toBe(10);
    expect(mockedPostRepo.findFeed).toHaveBeenCalledWith(
      AUTHOR_ADDRESS.toLowerCase(),
      3,
      10
    );
  });

  it("should return feed in reverse-chronological order", async () => {
    const posts = [
      makePost({ id: 3, created_at: new Date("2024-01-03") }),
      makePost({ id: 2, created_at: new Date("2024-01-02") }),
      makePost({ id: 1, created_at: new Date("2024-01-01") }),
    ];
    mockedPostRepo.findFeed.mockResolvedValue({ posts, total: 3 });

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    const returnedPosts = res.body.posts;
    for (let i = 0; i < returnedPosts.length - 1; i++) {
      expect(
        new Date(returnedPosts[i].created_at).getTime()
      ).toBeGreaterThanOrEqual(
        new Date(returnedPosts[i + 1].created_at).getTime()
      );
    }
  });

  it("should return 400 for invalid page parameter", async () => {
    const res = await request(app)
      .get("/api/feed?page=-1")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for limit exceeding maximum", async () => {
    const res = await request(app)
      .get("/api/feed?limit=101")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 401 without authentication", async () => {
    const res = await request(app).get("/api/feed");

    expect(res.status).toBe(401);
  });

  it("should return 500 when repository throws an error", async () => {
    mockedPostRepo.findFeed.mockRejectedValue(new Error("DB error"));

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
