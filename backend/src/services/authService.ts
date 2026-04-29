import crypto from "crypto";
import * as nonceRepository from "../repositories/nonceRepository";

/** Nonce expiration time in milliseconds (5 minutes) */
const NONCE_EXPIRATION_MS = 5 * 60 * 1000;

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
