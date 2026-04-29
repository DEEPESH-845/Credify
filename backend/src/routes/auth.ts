import { Router, Request, Response } from "express";
import { validate } from "../middleware/validate";
import { nonceRequestSchema, verifyRequestSchema } from "../validators/schemas";
import { generateNonce, verifySignature } from "../services/authService";

const router = Router();

/**
 * POST /api/auth/nonce
 * Accepts { address } in the request body, generates a cryptographically
 * random nonce, stores it with an expiration, and returns { nonce }.
 */
router.post(
  "/nonce",
  validate(nonceRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { address } = req.body;
      const nonce = await generateNonce(address);
      res.status(200).json({ nonce });
    } catch (err) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate nonce",
        },
      });
    }
  }
);

/**
 * POST /api/auth/verify
 * Accepts { address, signature, nonce } in the request body.
 * Recovers the signer from the signature, compares to claimed address,
 * issues JWT on match, returns 401 on mismatch or invalid nonce.
 * Creates user profile record on first-time authentication.
 */
router.post(
  "/verify",
  validate(verifyRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { address, signature, nonce } = req.body;
      const result = await verifySignature(address, signature, nonce);
      res.status(200).json({ token: result.token, address: result.address });
    } catch (err: any) {
      if (
        err.code === "AUTH_NONCE_INVALID" ||
        err.code === "AUTH_SIGNATURE_MISMATCH"
      ) {
        res.status(401).json({
          error: {
            code: err.code,
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to verify signature",
        },
      });
    }
  }
);

export default router;
