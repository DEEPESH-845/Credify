import { Router, Response } from "express";
import multer from "multer";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createProfileSchema, updateProfileSchema } from "../validators/schemas";
import * as profileService from "../services/profileService";
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from "../services/ipfsService";

/**
 * Multer configured for in-memory storage with a file-size limit.
 * The field name expected from the client is "image".
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

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

/**
 * POST /api/profiles/:address/image
 * Upload a profile image. Requires JWT authentication.
 * Only the profile owner (matching JWT address) can upload.
 * Accepts multipart/form-data with field name "image".
 * Validates file type (JPEG, PNG) and size.
 * Delegates to IPFS Service and stores the CID on the profile.
 */
router.post(
  "/:address/image",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single("image")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: {
              code: "FILE_TOO_LARGE",
              message: `File exceeds the maximum allowed size of ${MAX_FILE_SIZE} bytes`,
            },
          });
          return;
        }
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: err.message,
          },
        });
        return;
      }
      if (err) {
        res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "File upload failed",
          },
        });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const address = req.params.address as string;
      const requesterAddress = req.user!.address;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "No image file provided. Use field name 'image'.",
          },
        });
        return;
      }

      const result = await profileService.uploadProfileImage(
        address,
        requesterAddress,
        file.buffer,
        file.mimetype
      );

      res.status(200).json({
        cid: result.cid,
        profile: result.profile,
      });
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

      if (err instanceof FileTooLargeError || err.code === "FILE_TOO_LARGE") {
        res.status(413).json({
          error: {
            code: "FILE_TOO_LARGE",
            message: err.message,
          },
        });
        return;
      }

      if (
        err instanceof UnsupportedFileTypeError ||
        err.code === "UNSUPPORTED_FILE_TYPE"
      ) {
        res.status(415).json({
          error: {
            code: "UNSUPPORTED_FILE_TYPE",
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to upload profile image",
        },
      });
    }
  }
);

export default router;
