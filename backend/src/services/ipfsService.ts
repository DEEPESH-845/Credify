/**
 * IPFS Service — Pinata implementation with in-memory fallback.
 *
 * When PINATA_JWT and PINATA_GATEWAY are set, files are uploaded to Pinata
 * and served via the Pinata gateway. Otherwise, falls back to an in-memory
 * store for local development.
 */

import { PinataSDK } from "pinata";

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
// Pinata client (initialized lazily, only when credentials are available)
// ---------------------------------------------------------------------------

const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || "";

function isPinataConfigured(): boolean {
  return PINATA_JWT.length > 0 && PINATA_GATEWAY.length > 0;
}

let pinataClient: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinataClient) {
    pinataClient = new PinataSDK({
      pinataJwt: PINATA_JWT,
      pinataGateway: PINATA_GATEWAY,
    });
  }
  return pinataClient;
}

// ---------------------------------------------------------------------------
// In-memory fallback store (for local dev without Pinata)
// ---------------------------------------------------------------------------

const ipfsStore = new Map<string, { buffer: Buffer; mimeType: string }>();

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Validate file size and MIME type.
 */
function validateFile(buffer: Buffer, mimeType: string): void {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new FileTooLargeError(MAX_FILE_SIZE);
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new UnsupportedFileTypeError(ALLOWED_MIME_TYPES);
  }
}

/**
 * Map MIME type to a file extension for Pinata uploads.
 */
function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "application/pdf": return "pdf";
    default: return "bin";
  }
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
    const pinata = getPinata();
    const file = new File([buffer], `upload.${getExtension(mimeType)}`, {
      type: mimeType,
    });
    const result = await pinata.upload.public.file(file);
    return result.cid;
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
    // Only store in memory for the fallback path
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
      const pinata = getPinata();
      const response = await pinata.gateways.public.get(cid);

      // response.data can be a Blob or other types
      const data = response.data;
      let buffer: Buffer;
      let mimeType = response.contentType || "application/octet-stream";

      if (data instanceof Blob) {
        const arrayBuffer = await data.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (typeof data === "string") {
        buffer = Buffer.from(data, "utf-8");
      } else {
        buffer = Buffer.from(JSON.stringify(data), "utf-8");
        mimeType = "application/json";
      }

      return { buffer, mimeType };
    } catch {
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