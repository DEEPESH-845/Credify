import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

/**
 * Express middleware factory that validates the request body against a Zod schema.
 * Returns 400 with VALIDATION_ERROR details if the body does not conform.
 * On success, replaces req.body with the parsed (and potentially transformed) data.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = formatZodError(result.error);

      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details,
        },
      });
      return;
    }

    // Replace body with parsed data (applies transforms like string trimming)
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates req.query against a Zod schema.
 * Useful for pagination and filter parameters.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = formatZodError(result.error);

      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Query parameter validation failed",
          details,
        },
      });
      return;
    }

    (req as any).validatedQuery = result.data;
    next();
  };
}

/**
 * Converts a ZodError into a flat object mapping field paths to error messages.
 */
function formatZodError(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    details[path] = issue.message;
  }

  return details;
}
