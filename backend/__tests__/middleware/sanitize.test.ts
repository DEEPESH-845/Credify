import express, { Express } from "express";
import request from "supertest";
import {
  stripHtmlTags,
  sanitizeValue,
  sanitizeMiddleware,
} from "../../src/middleware/sanitize";

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMiddleware);

  app.post("/test", (req, res) => {
    res.status(200).json({ data: req.body });
  });

  return app;
}

describe("stripHtmlTags", () => {
  it("should return plain text unchanged", () => {
    expect(stripHtmlTags("Hello world")).toBe("Hello world");
  });

  it("should strip simple HTML tags", () => {
    expect(stripHtmlTags("<b>bold</b>")).toBe("bold");
  });

  it("should strip script tags and their content", () => {
    expect(stripHtmlTags('<script>alert("xss")</script>')).toBe("");
  });

  it("should strip script tags with attributes", () => {
    expect(
      stripHtmlTags('<script type="text/javascript">alert(1)</script>')
    ).toBe("");
  });

  it("should strip style tags and their content", () => {
    expect(stripHtmlTags("<style>body { color: red; }</style>")).toBe("");
  });

  it("should strip nested HTML tags", () => {
    expect(stripHtmlTags("<div><p>Hello <b>world</b></p></div>")).toBe(
      "Hello world"
    );
  });

  it("should handle self-closing tags", () => {
    expect(stripHtmlTags("line1<br/>line2")).toBe("line1line2");
  });

  it("should preserve text around stripped tags", () => {
    expect(stripHtmlTags("before<span>middle</span>after")).toBe(
      "beforemiddleafter"
    );
  });

  it("should handle empty string", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("should handle strings with angle brackets that are not tags", () => {
    // The xss library encodes > as &gt; and strips < followed by content as potential tags
    expect(stripHtmlTags("5 > 3 and 2 < 4")).toBe("5 &gt; 3 and 2 ");
  });

  it("should strip img tags with event handlers", () => {
    expect(stripHtmlTags('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("should strip multiple script blocks", () => {
    const input = '<script>a()</script>text<script>b()</script>';
    expect(stripHtmlTags(input)).toBe("text");
  });
});

describe("sanitizeValue", () => {
  it("should sanitize a string", () => {
    expect(sanitizeValue("<b>bold</b>")).toBe("bold");
  });

  it("should return numbers unchanged", () => {
    expect(sanitizeValue(42)).toBe(42);
  });

  it("should return booleans unchanged", () => {
    expect(sanitizeValue(true)).toBe(true);
  });

  it("should return null unchanged", () => {
    expect(sanitizeValue(null)).toBeNull();
  });

  it("should return undefined unchanged", () => {
    expect(sanitizeValue(undefined)).toBeUndefined();
  });

  it("should sanitize strings in an object", () => {
    const input = { name: "<b>Alice</b>", age: 30 };
    expect(sanitizeValue(input)).toEqual({ name: "Alice", age: 30 });
  });

  it("should sanitize strings in an array", () => {
    const input = ["<b>one</b>", "<i>two</i>", "three"];
    expect(sanitizeValue(input)).toEqual(["one", "two", "three"]);
  });

  it("should recursively sanitize nested objects", () => {
    const input = {
      user: {
        name: '<script>alert("xss")</script>Alice',
        bio: "<p>Hello</p>",
      },
    };
    expect(sanitizeValue(input)).toEqual({
      user: {
        name: "Alice",
        bio: "Hello",
      },
    });
  });

  it("should recursively sanitize arrays within objects", () => {
    const input = {
      tags: ["<b>tag1</b>", "<i>tag2</i>"],
    };
    expect(sanitizeValue(input)).toEqual({
      tags: ["tag1", "tag2"],
    });
  });

  it("should handle deeply nested structures", () => {
    const input = {
      level1: {
        level2: {
          level3: ["<script>x</script>clean"],
        },
      },
    };
    expect(sanitizeValue(input)).toEqual({
      level1: {
        level2: {
          level3: ["clean"],
        },
      },
    });
  });
});

describe("sanitizeMiddleware (integration)", () => {
  const app = createApp();

  it("should sanitize string fields in request body", async () => {
    const res = await request(app)
      .post("/test")
      .send({ content: "<b>Hello</b> world" });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe("Hello world");
  });

  it("should strip script tags from request body", async () => {
    const res = await request(app)
      .post("/test")
      .send({ content: '<script>alert("xss")</script>Safe text' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe("Safe text");
  });

  it("should preserve non-string fields", async () => {
    const res = await request(app)
      .post("/test")
      .send({ name: "<b>Alice</b>", age: 25, active: true });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Alice", age: 25, active: true });
  });

  it("should sanitize nested objects in request body", async () => {
    const res = await request(app)
      .post("/test")
      .send({
        profile: {
          bio: '<p>Hello <script>alert("xss")</script></p>',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.bio).toBe("Hello ");
  });

  it("should handle empty body gracefully", async () => {
    const res = await request(app)
      .post("/test")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({});
  });

  it("should sanitize arrays in request body", async () => {
    const res = await request(app)
      .post("/test")
      .send({ items: ["<b>one</b>", "<i>two</i>"] });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual(["one", "two"]);
  });
});
