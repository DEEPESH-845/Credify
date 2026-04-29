import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { paginationQuerySchema } from "../validators/schemas";
import * as postService from "../services/postService";

const router = Router();

/**
 * GET /api/feed
 * Get paginated, reverse-chronological feed of posts from
 * the user's accepted connections and the user's own posts.
 * Requires JWT authentication.
 * Query params: page (default 1), limit (default 20, max 100)
 */
router.get(
  "/",
  authMiddleware,
  validateQuery(paginationQuerySchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const callerAddress = req.user!.address;
      const { page, limit } = (req as any).validatedQuery;

      const result = await postService.getFeed(callerAddress, page, limit);

      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve feed",
        },
      });
    }
  }
);

export default router;
