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

/**
 * Search users by display_name or wallet_address.
 * Excludes the caller and returns paginated results.
 * Case-insensitive partial matching on display_name.
 * Exact or partial matching on wallet_address.
 */
export async function searchUsers(
  query: string,
  excludeAddress: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ users: User[]; total: number }> {
  const searchPattern = `%${query.toLowerCase()}%`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM users
     WHERE wallet_address != $1
       AND (LOWER(display_name) LIKE $2 OR LOWER(wallet_address) LIKE $2)`,
    [excludeAddress, searchPattern]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM users
     WHERE wallet_address != $1
       AND (LOWER(display_name) LIKE $2 OR LOWER(wallet_address) LIKE $2)
     ORDER BY display_name ASC NULLS LAST, wallet_address ASC
     LIMIT $3 OFFSET $4`,
    [excludeAddress, searchPattern, limit, offset]
  );

  return { users: result.rows, total };
}
