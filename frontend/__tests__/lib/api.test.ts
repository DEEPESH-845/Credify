/**
 * @jest-environment jsdom
 */
import { requestNonce, verifySignature, ApiRequestError } from "@/lib/api";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("API helper", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("requestNonce", () => {
    it("sends POST to /api/auth/nonce with address and returns nonce", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ nonce: "random-nonce-123" }),
      });

      const result = await requestNonce(address);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/auth/nonce",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ address }),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
      expect(result).toEqual({ nonce: "random-nonce-123" });
    });

    it("throws ApiRequestError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: { code: "INTERNAL_ERROR", message: "Failed to generate nonce" },
        }),
      });

      await expect(
        requestNonce("0x1234567890abcdef1234567890abcdef12345678")
      ).rejects.toThrow(ApiRequestError);
    });
  });

  describe("verifySignature", () => {
    it("sends POST to /api/auth/verify and returns token", async () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const signature = "0xsig";
      const nonce = "nonce-123";

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ token: "jwt-token", address }),
      });

      const result = await verifySignature(address, signature, nonce);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/auth/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ address, signature, nonce }),
        })
      );
      expect(result).toEqual({ token: "jwt-token", address });
    });

    it("throws ApiRequestError with error details on 401", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "AUTH_SIGNATURE_MISMATCH",
            message: "Signature does not match",
          },
        }),
      });

      try {
        await verifySignature("0xaddr", "0xbadsig", "nonce");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestError);
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(401);
        expect(apiErr.code).toBe("AUTH_SIGNATURE_MISMATCH");
        expect(apiErr.message).toBe("Signature does not match");
      }
    });

    it("handles non-JSON error responses gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
      });

      try {
        await verifySignature("0xaddr", "0xsig", "nonce");
        fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestError);
        const apiErr = err as ApiRequestError;
        expect(apiErr.status).toBe(502);
        expect(apiErr.code).toBe("UNKNOWN_ERROR");
      }
    });
  });
});
