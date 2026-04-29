import { Request, Response, NextFunction } from "express";
import {
  FileTooLargeError,
  UnsupportedFileTypeError,
  CIDNotFoundError,
} from "../services/ipfsService";

/**
 * Standard error response shape returned by the global error handler.
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

/**
 * Map of known error `code` properties to HTTP status codes.
 * Errors thrown by services often attach a `.code` string — this map
 * translates those codes into the correct HTTP status.
 */
const ERROR_CODE_TO_STATUS: Record<string, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  DUPLICATE_CONNECTION: 409,
  AUTH_INVALID_TOKEN: 401,
  AUTH_SIGNATURE_MISMATCH: 401,
  AUTH_NONCE_INVALID: 401,
  RATE_LIMIT_EXCEEDED: 429,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
};

/**
 * Checks whether an error originates from the PostgreSQL driver (pg).
 * pg errors carry a `severity` field and often a numeric `code` (SQLSTATE).
 */
function isDatabaseError(err: any): boolean {
  return (
    err != null &&
    typeof err.severity === "string" &&
    typeof err.code === "string" &&
    /^\d{5}$/.test(err.code)
  );
}

/**
 * Checks whether an error looks like an IPFS connectivity failure.
 * Common indicators: ECONNREFUSED, ENOTFOUND, ETIMEDOUT, or fetch/network
 * errors when talking to an IPFS gateway.
 */
function isIPFSConnectivityError(err: any): boolean {
  if (err == null) return false;

  const code = (err as any).code;
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET"
  ) {
    // Only treat as IPFS connectivity if the error message or address hints at IPFS
    const msg = String(err.message || "").toLowerCase();
    if (
      msg.includes("ipfs") ||
      msg.includes("5001") ||
      msg.includes("8080") ||
      msg.includes("pinata") ||
      msg.includes("infura")
    ) {
      return true;
    }
  }

  // Explicit IPFS service unavailable marker
  const msg = String(err.message || "").toLowerCase();
  if (msg.includes("ipfs") && (msg.includes("unavailable") || msg.includes("connect"))) {
    return true;
  }

  return false;
}

/**
 * Express global error handler.
 *
 * Catches all unhandled errors that bubble up from route handlers and
 * middleware. Logs the full error for debugging, then returns a structured
 * JSON response without leaking stack traces or internal details.
 *
 * Error mapping priority:
 * 1. Known error classes (FileTooLargeError, UnsupportedFileTypeError, CIDNotFoundError)
 * 2. Errors with a `.code` property matching ERROR_CODE_TO_STATUS
 * 3. Database (PostgreSQL) errors → 500 INTERNAL_ERROR
 * 4. IPFS connectivity errors → 502 SERVICE_UNAVAILABLE
 * 5. Everything else → 500 INTERNAL_ERROR
 */
export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Always log the full error for server-side debugging
  console.error("[GlobalErrorHandler]", err);

  let status: number;
  let code: string;
  let message: string;
  let details: Record<string, unknown> = {};

  // 1. Known IPFS error classes
  if (err instanceof FileTooLargeError) {
    status = 413;
    code = "FILE_TOO_LARGE";
    message = err.message;
  } else if (err instanceof UnsupportedFileTypeError) {
    status = 415;
    code = "UNSUPPORTED_FILE_TYPE";
    message = err.message;
  } else if (err instanceof CIDNotFoundError) {
    status = 404;
    code = "NOT_FOUND";
    message = err.message;
  }
  // 2. Errors with a known `.code` property
  else if (err.code && ERROR_CODE_TO_STATUS[err.code]) {
    status = ERROR_CODE_TO_STATUS[err.code];
    code = err.code;
    message = err.message || "An error occurred";
  }
  // 3. Database errors (PostgreSQL)
  else if (isDatabaseError(err)) {
    status = 500;
    code = "INTERNAL_ERROR";
    message = "An internal error occurred";
  }
  // 4. IPFS connectivity failures
  else if (isIPFSConnectivityError(err)) {
    status = 502;
    code = "SERVICE_UNAVAILABLE";
    message = "A required external service is currently unavailable";
  }
  // 5. Catch-all
  else {
    status = 500;
    code = "INTERNAL_ERROR";
    message = "An internal error occurred";
  }

  const body: ErrorResponse = {
    error: {
      code,
      message,
      details,
    },
  };

  res.status(status).json(body);
}
