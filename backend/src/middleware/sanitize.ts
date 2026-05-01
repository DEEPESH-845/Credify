import { Request, Response, NextFunction } from "express";
import xss from "xss";

/**
 * Sanitizes a string using the xss library to prevent XSS attacks.
 * Strips all HTML tags and attributes.
 */
export function sanitizeString(input: string): string {
  return xss(input, {
    whiteList: {},          // No tags allowed
    stripIgnoreTag: true,   // Strip all tags not in whitelist
    stripIgnoreTagBody: ["script", "style"], // Remove script/style content entirely
  });
}

/**
 * Recursively sanitizes all string values in an object or array.
 * Non-string primitives, null, and undefined are returned as-is.
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

/**
 * Express middleware that sanitizes all string inputs in the request body
 * to strip HTML/script tags and prevent XSS attacks.
 *
 * Applied globally to all routes. Recursively processes nested objects and arrays.
 */
export function sanitizeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  next();
}

/** @deprecated Use sanitizeString instead */
export function stripHtmlTags(input: string): string {
  return sanitizeString(input);
}
