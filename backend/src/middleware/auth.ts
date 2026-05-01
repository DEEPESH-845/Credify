import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

// Warn if using default secret in production
if (JWT_SECRET === "dev-secret-change-in-production" && process.env.NODE_ENV === "production") {
  console.error("⚠️  CRITICAL: JWT_SECRET is using the default value. Set a strong secret in production!");
}

export interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
  };
}

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the decoded wallet address to req.user.
 * Returns 401 for missing, expired, or invalid tokens.
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "AUTH_INVALID_TOKEN",
        message: "Missing or malformed authorization header",
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    if (!decoded.address || typeof decoded.address !== "string") {
      res.status(401).json({
        error: {
          code: "AUTH_INVALID_TOKEN",
          message: "Token payload missing wallet address",
        },
      });
      return;
    }

    req.user = { address: decoded.address.toLowerCase() };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: {
          code: "AUTH_INVALID_TOKEN",
          message: "Token has expired",
        },
      });
      return;
    }

    res.status(401).json({
      error: {
        code: "AUTH_INVALID_TOKEN",
        message: "Invalid token",
      },
    });
  }
}

export { JWT_SECRET };
