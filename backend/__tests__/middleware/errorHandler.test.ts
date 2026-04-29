import express, { Express, Request, Response, NextFunction } from "express";
import request from "supertest";
import { globalErrorHandler } from "../../src/middleware/errorHandler";
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
  CIDNotFoundError,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from "../../src/services/ipfsService";

/**
 * Helper: creates a minimal Express app with a single route that throws
 * the provided error, followed by the global error handler.
 */
function createApp(errorFactory: () => Error): Express {
  const app = express();
  app.use(express.json());

  app.get("/test", (_req: Request, _res: Response, _next: NextFunction) => {
    throw errorFactory();
  });

  // Also test async route errors forwarded via next()
  app.post("/test-async", (req: Request, _res: Response, next: NextFunction) => {
    try {
      throw errorFactory();
    } catch (err) {
      next(err);
    }
  });

  app.use(globalErrorHandler);
  return app;
}

describe("globalErrorHandler", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ---------------------------------------------------------------
  // Response format
  // ---------------------------------------------------------------
  describe("response format", () => {
    it("should return a JSON body with error.code, error.message, and error.details", async () => {
      const app = createApp(() => new Error("boom"));
      const res = await request(app).get("/test");

      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toHaveProperty("code");
      expect(res.body.error).toHaveProperty("message");
      expect(res.body.error).toHaveProperty("details");
    });

    it("should not include stack traces in the response", async () => {
      const app = createApp(() => new Error("boom"));
      const res = await request(app).get("/test");

      const body = JSON.stringify(res.body);
      expect(body).not.toContain("at ");
      expect(body).not.toContain("Error:");
      expect(res.body.error.stack).toBeUndefined();
    });

    it("should log the full error to console.error", async () => {
      const app = createApp(() => new Error("secret details"));
      await request(app).get("/test");

      expect(consoleSpy).toHaveBeenCalled();
      const loggedArgs = consoleSpy.mock.calls[0];
      expect(loggedArgs[0]).toBe("[GlobalErrorHandler]");
    });
  });

  // ---------------------------------------------------------------
  // Known IPFS error classes
  // ---------------------------------------------------------------
  describe("FileTooLargeError", () => {
    it("should return 413 with FILE_TOO_LARGE code", async () => {
      const app = createApp(() => new FileTooLargeError(MAX_FILE_SIZE));
      const res = await request(app).get("/test");

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe("FILE_TOO_LARGE");
      expect(res.body.error.message).toContain("exceeds");
    });
  });

  describe("UnsupportedFileTypeError", () => {
    it("should return 415 with UNSUPPORTED_FILE_TYPE code", async () => {
      const app = createApp(() => new UnsupportedFileTypeError(ALLOWED_MIME_TYPES));
      const res = await request(app).get("/test");

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
      expect(res.body.error.message).toContain("Unsupported");
    });
  });

  describe("CIDNotFoundError", () => {
    it("should return 404 with NOT_FOUND code", async () => {
      const app = createApp(() => new CIDNotFoundError("QmFakeCid123"));
      const res = await request(app).get("/test");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
      expect(res.body.error.message).toContain("QmFakeCid123");
    });
  });

  // ---------------------------------------------------------------
  // Errors with a `.code` property
  // ---------------------------------------------------------------
  describe("errors with known .code property", () => {
    it("should map FORBIDDEN to 403", async () => {
      const app = createApp(() => {
        const err = new Error("Not allowed");
        (err as any).code = "FORBIDDEN";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toBe("Not allowed");
    });

    it("should map NOT_FOUND to 404", async () => {
      const app = createApp(() => {
        const err = new Error("Resource missing");
        (err as any).code = "NOT_FOUND";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("should map VALIDATION_ERROR to 400", async () => {
      const app = createApp(() => {
        const err = new Error("Bad input");
        (err as any).code = "VALIDATION_ERROR";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should map DUPLICATE_CONNECTION to 409", async () => {
      const app = createApp(() => {
        const err = new Error("Already connected");
        (err as any).code = "DUPLICATE_CONNECTION";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_CONNECTION");
    });

    it("should map AUTH_INVALID_TOKEN to 401", async () => {
      const app = createApp(() => {
        const err = new Error("Token expired");
        (err as any).code = "AUTH_INVALID_TOKEN";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTH_INVALID_TOKEN");
    });

    it("should map AUTH_SIGNATURE_MISMATCH to 401", async () => {
      const app = createApp(() => {
        const err = new Error("Signature mismatch");
        (err as any).code = "AUTH_SIGNATURE_MISMATCH";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTH_SIGNATURE_MISMATCH");
    });

    it("should map AUTH_NONCE_INVALID to 401", async () => {
      const app = createApp(() => {
        const err = new Error("Nonce invalid");
        (err as any).code = "AUTH_NONCE_INVALID";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("AUTH_NONCE_INVALID");
    });

    it("should map FILE_TOO_LARGE code to 413", async () => {
      const app = createApp(() => {
        const err = new Error("Too big");
        (err as any).code = "FILE_TOO_LARGE";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe("FILE_TOO_LARGE");
    });

    it("should map UNSUPPORTED_FILE_TYPE code to 415", async () => {
      const app = createApp(() => {
        const err = new Error("Wrong type");
        (err as any).code = "UNSUPPORTED_FILE_TYPE";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    });
  });

  // ---------------------------------------------------------------
  // Database errors (PostgreSQL)
  // ---------------------------------------------------------------
  describe("database errors", () => {
    it("should return 500 INTERNAL_ERROR for PostgreSQL errors", async () => {
      const app = createApp(() => {
        const err = new Error("relation \"users\" does not exist");
        (err as any).severity = "ERROR";
        (err as any).code = "42P01"; // SQLSTATE: undefined_table
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
      expect(res.body.error.message).toBe("An internal error occurred");
    });

    it("should not leak database error details in the response", async () => {
      const app = createApp(() => {
        const err = new Error("duplicate key value violates unique constraint");
        (err as any).severity = "ERROR";
        (err as any).code = "23505"; // SQLSTATE: unique_violation
        (err as any).detail = 'Key (wallet_address)=(0xabc) already exists.';
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(500);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("wallet_address");
      expect(body).not.toContain("0xabc");
      expect(body).not.toContain("duplicate key");
    });
  });

  // ---------------------------------------------------------------
  // IPFS connectivity errors
  // ---------------------------------------------------------------
  describe("IPFS connectivity errors", () => {
    it("should return 502 SERVICE_UNAVAILABLE for IPFS ECONNREFUSED", async () => {
      const app = createApp(() => {
        const err = new Error("connect ECONNREFUSED 127.0.0.1:5001 (ipfs)");
        (err as any).code = "ECONNREFUSED";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("should return 502 for IPFS ETIMEDOUT", async () => {
      const app = createApp(() => {
        const err = new Error("request to ipfs gateway timed out");
        (err as any).code = "ETIMEDOUT";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("should return 502 for IPFS unavailable message", async () => {
      const app = createApp(() => {
        return new Error("IPFS service unavailable");
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    });
  });

  // ---------------------------------------------------------------
  // Generic / unknown errors
  // ---------------------------------------------------------------
  describe("unknown errors", () => {
    it("should return 500 INTERNAL_ERROR for generic errors", async () => {
      const app = createApp(() => new Error("something unexpected"));
      const res = await request(app).get("/test");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
      expect(res.body.error.message).toBe("An internal error occurred");
    });

    it("should return 500 for errors with unknown code property", async () => {
      const app = createApp(() => {
        const err = new Error("weird error");
        (err as any).code = "SOME_UNKNOWN_CODE";
        return err;
      });
      const res = await request(app).get("/test");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });

    it("should handle non-Error objects thrown", async () => {
      const app = express();
      app.get("/test", (_req, _res, _next) => {
        throw "string error";
      });
      app.use(globalErrorHandler);

      const res = await request(app).get("/test");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  // ---------------------------------------------------------------
  // Async errors forwarded via next()
  // ---------------------------------------------------------------
  describe("async errors via next()", () => {
    it("should handle errors passed to next()", async () => {
      const app = createApp(() => {
        const err = new Error("async failure");
        (err as any).code = "FORBIDDEN";
        return err;
      });
      const res = await request(app).post("/test-async");

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
