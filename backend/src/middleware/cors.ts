import { Request, Response, NextFunction } from "express";

/**
 * CORS middleware configuration options.
 */
export interface CorsOptions {
  /** Allowed origin for cross-origin requests. */
  origin: string;
  /** HTTP methods allowed for cross-origin requests. */
  methods?: string[];
  /** Headers allowed in cross-origin requests. */
  allowedHeaders?: string[];
  /** Whether to include credentials (cookies, authorization headers) in CORS requests. */
  credentials?: boolean;
  /** Max age in seconds for preflight cache. */
  maxAge?: number;
}

const DEFAULT_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization"];

/**
 * Creates a CORS middleware that restricts API access to the configured frontend origin.
 *
 * Reads the allowed origin from the FRONTEND_ORIGIN environment variable,
 * defaulting to http://localhost:3000 for development.
 *
 * Handles preflight OPTIONS requests by responding with 204 and appropriate headers.
 * For non-preflight requests, sets the Access-Control-Allow-Origin header only if
 * the request origin matches the configured origin.
 */
export function createCorsMiddleware(options?: Partial<CorsOptions>) {
  const originsEnv =
    options?.origin ??
    process.env.FRONTEND_ORIGIN ??
    "http://localhost:3000";
  // Support comma-separated origins for multiple allowed domains
  const allowedOrigins = originsEnv.split(",").map((o) => o.trim());
  const methods = options?.methods ?? DEFAULT_METHODS;
  const allowedHeaders = options?.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
  const credentials = options?.credentials ?? true;
  const maxAge = options?.maxAge ?? 86400;

  return function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const requestOrigin = req.headers.origin;

    // Check if the request origin matches any allowed origin
    // Also support wildcard subdomain patterns like https://*.vercel.app
    const isAllowed = requestOrigin
      ? allowedOrigins.some((allowed) => {
          if (allowed.includes("*")) {
            // Convert wildcard pattern to regex
            const pattern = allowed
              .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
              .replace(/\*/g, "[a-zA-Z0-9-]+");
            return new RegExp(`^${pattern}$`).test(requestOrigin);
          }
          return requestOrigin === allowed;
        })
      : false;

    if (isAllowed && requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);

      if (credentials) {
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }

      // Handle preflight OPTIONS requests
      if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
        res.setHeader(
          "Access-Control-Allow-Headers",
          allowedHeaders.join(", ")
        );
        res.setHeader("Access-Control-Max-Age", String(maxAge));
        res.status(204).end();
        return;
      }
    }

    next();
  };
}

/**
 * Default CORS middleware instance using FRONTEND_ORIGIN env var
 * or http://localhost:3000 as fallback.
 */
export const corsMiddleware = createCorsMiddleware();
