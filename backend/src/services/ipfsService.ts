/**
 * IPFS Service — stub implementation.
 *
 * In production this would connect to an IPFS node (e.g. via ipfs-http-client
 * or a pinning service like Pinata). The stub returns a deterministic CID so
 * the rest of the application can be developed and tested without a running
 * IPFS daemon.
 */

/** Maximum file size in bytes (default 5 MB). */
export const MAX_FILE_SIZE = parseInt(
  process.env.MAX_UPLOAD_FILE_SIZE || String(5 * 1024 * 1024),
  10
);

/** Allowed MIME types for image uploads. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

/** Allowed MIME types for document uploads. */
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf"];

/** All allowed MIME types. */
export const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
];

export class FileTooLargeError extends Error {
  code = "FILE_TOO_LARGE";
  constructor(maxBytes: number) {
    super(`File exceeds the maximum allowed size of ${maxBytes} bytes`);
  }
}

export class UnsupportedFileTypeError extends Error {
  code = "UNSUPPORTED_FILE_TYPE";
  constructor(allowedTypes: string[]) {
    super(`Unsupported file type. Allowed types: ${allowedTypes.join(", ")}`);
  }
}

/**
 * Upload a buffer to IPFS and return the resulting CID.
 *
 * @param buffer   File contents
 * @param mimeType MIME type of the file
 * @returns The IPFS content identifier (CID)
 */
export async function uploadToIPFS(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new FileTooLargeError(MAX_FILE_SIZE);
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new UnsupportedFileTypeError(ALLOWED_MIME_TYPES);
  }

  // --- Stub: in production, upload to IPFS and return real CID ---
  // For now, generate a deterministic fake CID from the buffer content.
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return `Qm${hash.slice(0, 44)}`;
}

/**
 * Upload an image to IPFS. Validates that the MIME type is an allowed image type.
 *
 * @param buffer   Image file contents
 * @param mimeType MIME type of the image
 * @returns The IPFS content identifier (CID)
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new UnsupportedFileTypeError(ALLOWED_IMAGE_TYPES);
  }

  return uploadToIPFS(buffer, mimeType);
}
