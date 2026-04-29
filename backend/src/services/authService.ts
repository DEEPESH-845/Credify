import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import * as nonceRepository from "../repositories/nonceRepository";
import * as userRepository from "../repositories/userRepository";

/** Nonce expiration time in milliseconds (5 minutes) */
const NONCE_EXPIRATION_MS = 5 * 60 * 1000;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "24h";

export interface VerifyResult {
  token: string;
  address: string;
}

/**
 * Generates a cryptographically random nonce, stores it in the nonces table
 * with an expiration, and returns the nonce string.
 */
export async function generateNonce(address: string): Promise<string> {
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + NONCE_EXPIRATION_MS);

  await nonceRepository.create(address.toLowerCase(), nonce, expiresAt);

  return nonce;
}

/**
 * Verifies a signed nonce message against the claimed wallet address.
 *
 * 1. Looks up the nonce in the database for the given address
 * 2. Checks the nonce hasn't expired
 * 3. Recovers the signer address from the signature using ethers.js verifyMessage
 * 4. Compares recovered address to claimed address (case-insensitive)
 * 5. On match: issues JWT, invalidates nonce, creates user if first time
 * 6. On mismatch: throws with AUTH_SIGNATURE_MISMATCH
 * 7. On nonce not found or expired: throws with AUTH_NONCE_INVALID
 */
export async function verifySignature(
  address: string,
  signature: string,
  nonce: string
): Promise<VerifyResult> {
  const normalizedAddress = address.toLowerCase();

  // Look up the nonce for this address
  const nonceRecord = await nonceRepository.findByAddressAndNonce(
    normalizedAddress,
    nonce
  );

  if (!nonceRecord) {
    const error = new Error("Nonce not found or already used");
    (error as any).code = "AUTH_NONCE_INVALID";
    throw error;
  }

  // Check if nonce has expired
  if (new Date(nonceRecord.expires_at) <= new Date()) {
    // Clean up expired nonce
    await nonceRepository.deleteById(nonceRecord.id);
    const error = new Error("Nonce has expired");
    (error as any).code = "AUTH_NONCE_INVALID";
    throw error;
  }

  // Recover signer address from signature
  let recoveredAddress: string;
  try {
    recoveredAddress = ethers.verifyMessage(nonce, signature);
  } catch {
    const error = new Error("Invalid signature");
    (error as any).code = "AUTH_SIGNATURE_MISMATCH";
    throw error;
  }

  // Compare recovered address to claimed address (case-insensitive)
  if (recoveredAddress.toLowerCase() !== normalizedAddress) {
    const error = new Error("Signature does not match claimed address");
    (error as any).code = "AUTH_SIGNATURE_MISMATCH";
    throw error;
  }

  // Invalidate the used nonce
  await nonceRepository.deleteById(nonceRecord.id);

  // Create user profile if first-time authentication
  const existingUser = await userRepository.findByAddress(normalizedAddress);
  if (!existingUser) {
    await userRepository.create(normalizedAddress);
  }

  // Issue JWT
  const token = jwt.sign(
    { address: normalizedAddress },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );

  return { token, address: normalizedAddress };
}
