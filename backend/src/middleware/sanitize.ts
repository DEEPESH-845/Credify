import { Request, Response, NextFunction } from "express";

/**
 * Strips HTML tags from a string, including script/style element content.
 * Preserves the non-HTML text content.
 */
export function stripHtmlTags(input: string): string {
  // First remove <script>...</script> and <style>...</style> blocks entirely (including content)
  let result = input.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Then strip all remaining HTML tags but keep their text content
  result = result.replace(/<[^>]*>/g, "");

  return result;
}

/**
 * Recursively sanitizes all string values in an object or array.
 * Non-string primitives, null, and undefined are returned as-is.
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return stripHtmlTags(value);
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
