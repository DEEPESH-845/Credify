import pool from "../config/database";
import { Nonce } from "../types/models";

export async function create(
  walletAddress: string,
  nonce: string,
  expiresAt: Date
): Promise<Nonce> {
  const result = await pool.query(
    `INSERT INTO nonces (wallet_address, nonce, expires_at) VALUES ($1, $2, $3) RETURNING *`,
    [walletAddress, nonce, expiresAt]
  );
  return result.rows[0];
}

export async function findByAddress(
  walletAddress: string
): Promise<Nonce | null> {
  const result = await pool.query(
    `SELECT * FROM nonces WHERE wallet_address = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [walletAddress]
  );
  return result.rows[0] ?? null;
}

export async function deleteById(id: number): Promise<void> {
  await pool.query(`DELETE FROM nonces WHERE id = $1`, [id]);
}
