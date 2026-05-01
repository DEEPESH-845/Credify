import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { validate, validateQuery } from "../middleware/validate";
import {
  connectionRequestSchema,
  connectionsQuerySchema,
} from "../validators/schemas";
import * as connectionService from "../services/connectionService";

const router = Router();

/**
 * POST /api/connections/request
 * Send a connection request. Requires JWT authentication.
 * Body: { recipient_address: string }
 */
router.post(
  "/request",
  authMiddleware,
  validate(connectionRequestSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const requesterAddress = req.user!.address;
      const { recipient_address } = req.body;

      const connection = await connectionService.sendRequest(
        requesterAddress,
        recipient_address
      );

      res.status(201).json(connection);
    } catch (err: any) {
      if (err.code === "DUPLICATE_CONNECTION") {
        res.status(409).json({
          error: {
            code: "DUPLICATE_CONNECTION",
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

      if (err.code === "VALIDATION_ERROR") {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to send connection request",
        },
      });
    }
  }
);

/**
 * PUT /api/connections/:id/accept
 * Accept a pending connection request. Requires JWT authentication.
 * Only the recipient of the request can accept.
 */
router.put(
  "/:id/accept",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const connectionId = parseInt(req.params.id as string, 10);

      if (isNaN(connectionId)) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid connection ID",
          },
        });
        return;
      }

      const callerAddress = req.user!.address;
      const connection = await connectionService.acceptRequest(
        connectionId,
        callerAddress
      );

      res.status(200).json(connection);
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

      if (err.code === "VALIDATION_ERROR") {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to accept connection request",
        },
      });
    }
  }
);

/**
 * PUT /api/connections/:id/decline
 * Decline a pending connection request. Requires JWT authentication.
 * Only the recipient of the request can decline.
 */
router.put(
  "/:id/decline",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const connectionId = parseInt(req.params.id as string, 10);

      if (isNaN(connectionId)) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid connection ID",
          },
        });
        return;
      }

      const callerAddress = req.user!.address;
      const connection = await connectionService.declineRequest(
        connectionId,
        callerAddress
      );

      res.status(200).json(connection);
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

      if (err.code === "VALIDATION_ERROR") {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: err.message,
          },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to decline connection request",
        },
      });
    }
  }
);

/**
 * GET /api/connections
 * List accepted connections with pagination and profile summaries.
 * Requires JWT authentication.
 * Query params: page (default 1), limit (default 20, max 100)
 */
router.get(
  "/",
  authMiddleware,
  validateQuery(connectionsQuerySchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const callerAddress = req.user!.address;
      const { page, limit, status } = (req as any).validatedQuery;

      const result = await connectionService.listConnections(
        callerAddress,
        page,
        limit,
        status
      );

      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve connections",
        },
      });
    }
  }
);

export default router;
