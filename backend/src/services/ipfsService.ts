/**
 * IPFS Service — Pinata implementation with in-memory fallback.
 *
 * When PINATA_JWT and PINATA_GATEWAY are set, files are uploaded to Pinata
 * via the REST API and served via the Pinata gateway. Otherwise, falls back
 * to an in-memory store for local development.
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

export class CIDNotFoundError extends Error {
  code = "NOT_FOUND";
  constructor(cid: string) {
    super(`Content not found for CID: ${cid}`);
  }
}

// ---------------------------------------------------------------------------
// Pinata configuration
// ---------------------------------------------------------------------------

const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "";

function isPinataConfigured(): boolean {
  return PINATA_JWT.length > 0 && PINATA_GATEWAY.length > 0;
}

// ---------------------------------------------------------------------------
// In-memory fallback store (for local dev without Pinata)
// ---------------------------------------------------------------------------

const ipfsStore = new Map<string, { buffer: Buffer; mimeType: string }>();

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function validateFile(buffer: Buffer, mimeType: string): void {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new FileTooLargeError(MAX_FILE_SIZE);
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new UnsupportedFileTypeError(ALLOWED_MIME_TYPES);
  }
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "application/pdf": return "pdf";
    default: return "bin";
  }
}

/**
 * Upload a buffer to Pinata using the REST API directly.
 * This avoids any SDK compatibility issues with File/Blob globals.
 */
async function uploadToPinataREST(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const fileName = `upload-${Date.now()}.${getExtension(mimeType)}`;

  // Build multipart form data manually using the built-in FormData
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append("file", blob, fileName);

  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Pinata upload failed (${response.status}): ${errorText}`
    );
  }

  const result = await response.json() as { data: { cid: string } };

  if (!result.data?.cid) {
    throw new Error("Pinata upload response missing CID");
  }

  return result.data.cid;
}

/**
 * Upload a buffer to IPFS and return the resulting CID.
 */
export async function uploadToIPFS(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  validateFile(buffer, mimeType);

  if (isPinataConfigured()) {
    try {
      return await uploadToPinataREST(buffer, mimeType);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("IPFS upload error:", message);
      throw new Error(`IPFS upload failed: ${message}`);
    }
  }

  // Fallback: deterministic fake CID
  const crypto = await import("crypto");
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return `Qm${hash.slice(0, 44)}`;
}

/**
 * Upload an image to IPFS. Validates that the MIME type is an allowed image type.
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

/**
 * Upload a buffer to IPFS and store it for later retrieval.
 * With Pinata, the file is pinned and retrievable via the gateway.
 * With the fallback, it's stored in the in-memory map.
 */
export async function uploadAndStore(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const cid = await uploadToIPFS(buffer, mimeType);

  if (!isPinataConfigured()) {
    ipfsStore.set(cid, { buffer, mimeType });
  }

  return cid;
}

/**
 * Retrieve file content from IPFS by CID.
 * With Pinata, fetches from the gateway. With fallback, reads from memory.
 */
export async function retrieveFromIPFS(
  cid: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (isPinataConfigured()) {
    try {
      const gatewayUrl = `https://${PINATA_GATEWAY}/ipfs/${cid}`;
      const response = await fetch(gatewayUrl);

      if (!response.ok) {
        throw new Error(`Gateway returned ${response.status}`);
      }

      const mimeType =
        response.headers.get("content-type") || "application/octet-stream";
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return { buffer, mimeType };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`IPFS retrieval failed for CID ${cid}: ${message}`);
      throw new CIDNotFoundError(cid);
    }
  }

  // Fallback: in-memory store
  const entry = ipfsStore.get(cid);
  if (!entry) {
    throw new CIDNotFoundError(cid);
  }
  return entry;
}

/** Exposed for testing — clears the in-memory IPFS store. */
export function _clearStore(): void {
  ipfsStore.clear();
}