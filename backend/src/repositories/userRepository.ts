import pool from "../config/database";
import { User, UpdateUserData } from "../types/models";

export async function create(walletAddress: string): Promise<User> {
  const result = await pool.query(
    `INSERT INTO users (wallet_address) VALUES ($1) RETURNING *`,
    [walletAddress]
  );
  return result.rows[0];
}

export async function findByAddress(
  walletAddress: string
): Promise<User | null> {
  const result = await pool.query(
    `SELECT * FROM users WHERE wallet_address = $1`,
    [walletAddress]
  );
  return result.rows[0] ?? null;
}

export async function update(
  walletAddress: string,
  data: UpdateUserData
): Promise<User | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.display_name !== undefined) {
    fields.push(`display_name = $${paramIndex++}`);
    values.push(data.display_name);
  }
  if (data.headline !== undefined) {
    fields.push(`headline = $${paramIndex++}`);
    values.push(data.headline);
  }
  if (data.bio !== undefined) {
    fields.push(`bio = $${paramIndex++}`);
    values.push(data.bio);
  }
  if (data.location !== undefined) {
    fields.push(`location = $${paramIndex++}`);
    values.push(data.location);
  }
  if (data.profile_image_cid !== undefined) {
    fields.push(`profile_image_cid = $${paramIndex++}`);
    values.push(data.profile_image_cid);
  }

  if (fields.length === 0) {
    return findByAddress(walletAddress);
  }

  fields.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE wallet_address = $${paramIndex} RETURNING *`,
    [...values, walletAddress]
  );
  return result.rows[0] ?? null;
}
