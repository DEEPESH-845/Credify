import pool from "../config/database";
import { Post } from "../types/models";

export async function create(
  authorAddress: string,
  content: string
): Promise<Post> {
  const result = await pool.query(
    `INSERT INTO posts (author_address, content) VALUES ($1, $2) RETURNING *`,
    [authorAddress, content]
  );
  return result.rows[0];
}

export async function deleteById(id: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM posts WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findFeed(
  walletAddress: string,
  page: number,
  limit: number
): Promise<{ posts: Post[]; total: number }> {
  const offset = (page - 1) * limit;

  const feedCondition = `
    WHERE author_address = $1
       OR author_address IN (
         SELECT CASE
           WHEN requester_address = $1 THEN recipient_address
           ELSE requester_address
         END
         FROM connections
         WHERE (requester_address = $1 OR recipient_address = $1)
           AND status = 'accepted'
       )`;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM posts ${feedCondition}`,
    [walletAddress]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await pool.query(
    `SELECT * FROM posts ${feedCondition}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [walletAddress, limit, offset]
  );

  return { posts: result.rows, total };
}
