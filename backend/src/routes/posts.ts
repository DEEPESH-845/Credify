import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { validate, validateQuery } from "../middleware/validate";
import {
  createPostSchema,
  paginationQuerySchema,
} from "../validators/schemas";
import * as postService from "../services/postService";

const router = Router();

/**
 * POST /api/posts
 * Create a new post. Requires JWT authentication.
 * Body: { content: string } — max 5000 characters.
 */
router.post(
  "/",
  authMiddleware,
  validate(createPostSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authorAddress = req.user!.address;
      const { content } = req.body;

      const post = await postService.createPost(authorAddress, content);

      res.status(201).json(post);
    } catch (err) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create post",
        },
      });
    }
  }
);

/**
 * DELETE /api/posts/:id
 * Delete own post. Requires JWT authentication.
 * Returns 403 if the caller is not the post author.
 * Returns 404 if the post does not exist.
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const postId = parseInt(req.params.id as string, 10);

      if (isNaN(postId)) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid post ID",
          },
        });
        return;
      }

      const callerAddress = req.user!.address;
      await postService.deletePost(postId, callerAddress);

      res.status(204).send();
    } catch (err: any) {
      if (err.code === "NOT_FOUND") {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: err.message,
          },
        });
        return;
      }

      if (err.code === "FORBIDDEN") {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete post",
        },
      });
    }
  }
);

export default router;
