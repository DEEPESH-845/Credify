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

export async function findById(id: number): Promise<Connection | null> {
  const result = await pool.query(
    `SELECT * FROM connections WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findExisting(
  addressA: string,
  addressB: string
): Promise<Connection | null> {
  const result = await pool.query(
    `SELECT * FROM connections
     WHERE (requester_address = $1 AND recipient_address = $2)
        OR (requester_address = $2 AND recipient_address = $1)`,
    [addressA, addressB]
  );
  return result.rows[0] ?? null;
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
  limit: number,
  status: "pending" | "accepted" | "declined" = "accepted"
): Promise<{ connections: Connection[]; total: number }> {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM connections
     WHERE (requester_address = $1 OR recipient_address = $1)
       AND status = $2`,
    [walletAddress, status]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM connections
     WHERE (requester_address = $1 OR recipient_address = $1)
       AND status = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [walletAddress, status, limit, offset]
  );

  return { connections: result.rows, total };
}
