import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createProfileSchema, updateProfileSchema } from "../validators/schemas";
import * as profileService from "../services/profileService";

const router = Router();

/**
 * POST /api/profiles
 * Create a new user profile. Requires JWT authentication.
 * The wallet_address in the body is validated against the Ethereum address format.
 */
router.post(
  "/",
  authMiddleware,
  validate(createProfileSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const profile = await profileService.createProfile(req.body);
      res.status(201).json(profile);
    } catch (err) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create profile",
        },
      });
    }
  }
);

/**
 * GET /api/profiles/:address
 * Get a user profile by wallet address. Requires JWT authentication.
 */
router.get(
  "/:address",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const address = req.params.address as string;
      const profile = await profileService.getProfile(address);

      if (!profile) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Profile not found",
          },
        });
        return;
      }

      res.status(200).json(profile);
    } catch (err) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve profile",
        },
      });
    }
  }
);

/**
 * PUT /api/profiles/:address
 * Update a user profile. Requires JWT authentication.
 * Only the profile owner (matching JWT address) can update.
 */
router.put(
  "/:address",
  authMiddleware,
  validate(updateProfileSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const address = req.params.address as string;
      const requesterAddress = req.user!.address;

      const profile = await profileService.updateProfile(
        address,
        requesterAddress,
        req.body
      );

      res.status(200).json(profile);
    } catch (err: any) {
      if (err.code === "FORBIDDEN") {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: err.message,
          },
        });
        return;
      }

      if (err.code === "NOT_FOUND") {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update profile",
        },
      });
    }
  }
);

export default router;
