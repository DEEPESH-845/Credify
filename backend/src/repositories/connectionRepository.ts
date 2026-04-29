import pool from "../config/database";
import { Connection } from "../types/models";

export async function create(
  requesterAddress: string,
  recipientAddress: string
): Promise<Connection> {
  const result = await pool.query(
    `INSERT INTO connections (requester_address, recipient_address) VALUES ($1, $2) RETURNING *`,
    [requesterAddress, recipientAddress]
  );
  return result.rows[0];
}

export async function updateStatus(
  id: number,
  status: "accepted" | "declined"
): Promise<Connection | null> {
  const result = await pool.query(
    `UPDATE connections SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] ?? null;
}

export async function findByUser(
  walletAddress: string,
  page: number,
  limit: number
): Promise<{ connections: Connection[]; total: number }> {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM connections
     WHERE (requester_address = $1 OR recipient_address = $1)
       AND status = 'accepted'`,
    [walletAddress]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM connections
     WHERE (requester_address = $1 OR recipient_address = $1)
       AND status = 'accepted'
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [walletAddress, limit, offset]
  );

  return { connections: result.rows, total };
}
