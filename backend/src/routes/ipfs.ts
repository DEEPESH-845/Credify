import { Router, Response } from "express";
import multer from "multer";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { uploadRateLimiter } from "../middleware/rateLimiter";
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
  CIDNotFoundError,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  uploadAndStore,
  retrieveFromIPFS,
} from "../services/ipfsService";

/**
 * Multer configured for in-memory storage with a file-size limit.
 * The field name expected from the client is "file".
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

/**
 * POST /api/ipfs/upload
 * Upload a file to IPFS. Requires JWT authentication.
 * Accepts multipart/form-data with field name "file".
 * Validates file type (JPEG, PNG, PDF) and size.
 * Returns the IPFS CID on success.
 */
router.post(
  "/upload",
  uploadRateLimiter,
  authMiddleware,
  (req: AuthenticatedRequest, res: Response, next) => {
    upload.single("file")(req, res, (err) => {
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
      const file = req.file;

      if (!file) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "No file provided. Use field name 'file'.",
          },
        });
        return;
      }

      // Validate MIME type before uploading
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        res.status(415).json({
          error: {
            code: "UNSUPPORTED_FILE_TYPE",
            message: `Unsupported file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
          },
        });
        return;
      }

      const cid = await uploadAndStore(file.buffer, file.mimetype);

      res.status(200).json({ cid });
    } catch (err: any) {
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
          message: "Failed to upload file",
        },
      });
    }
  }
);

/**
 * GET /api/ipfs/:cid
 * Retrieve a file from IPFS by CID.
 * This endpoint is public so that <img> tags can load images directly.
 * Returns the file content with the appropriate Content-Type header.
 */
router.get(
  "/:cid",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const cid = req.params.cid as string;

      const { buffer, mimeType } = await retrieveFromIPFS(cid);

      res.set("Content-Type", mimeType);
      res.status(200).send(buffer);
    } catch (err: any) {
      if (err instanceof CIDNotFoundError || err.code === "NOT_FOUND") {
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
          message: "Failed to retrieve file",
        },
      });
    }
  }
);

export default router;
