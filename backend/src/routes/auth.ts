import { Router, Request, Response } from "express";
import { validate } from "../middleware/validate";
import { nonceRequestSchema } from "../validators/schemas";
import { generateNonce } from "../services/authService";

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

export default router;
