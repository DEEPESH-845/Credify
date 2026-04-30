import { z } from "zod";

/**
 * Ethereum address pattern: 0x followed by 40 hex characters.
 */
const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

// --- Auth Schemas ---

export const nonceRequestSchema = z.object({
  address: ethereumAddress,
});

export const verifyRequestSchema = z.object({
  address: ethereumAddress,
  signature: z.string().min(1, "Signature is required"),
  nonce: z.string().min(1, "Nonce is required"),
});

// --- Profile Schemas ---

export const createProfileSchema = z.object({
  wallet_address: ethereumAddress,
  display_name: z.string().max(100, "Display name must be 100 characters or less").optional(),
  headline: z.string().max(200, "Headline must be 200 characters or less").optional(),
  bio: z.string().optional(),
  location: z.string().max(100, "Location must be 100 characters or less").optional(),
});

export const updateProfileSchema = z.object({
  display_name: z.string().max(100, "Display name must be 100 characters or less").optional(),
  headline: z.string().max(200, "Headline must be 200 characters or less").optional(),
  bio: z.string().optional(),
  location: z.string().max(100, "Location must be 100 characters or less").optional(),
});

// --- Connection Schemas ---

export const connectionRequestSchema = z.object({
  recipient_address: ethereumAddress,
});

// --- Post Schemas ---

export const createPostSchema = z.object({
  content: z
    .string()
    .min(1, "Post content cannot be empty")
    .max(5000, "Post content must be 5000 characters or less"),
});

// --- IPFS Schemas ---

export const ipfsUploadSchema = z.object({
  // File validation is handled by multer + custom middleware;
  // this schema validates any accompanying metadata fields.
});

// --- Pagination Query Schema ---

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().positive().max(100)),
});

export const connectionsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().positive().max(100)),
  status: z
    .enum(["pending", "accepted", "declined"])
    .optional()
    .default("accepted"),
});
