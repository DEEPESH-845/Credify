import { Pool } from "pg";

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(42) UNIQUE NOT NULL,
      display_name VARCHAR(100),
      headline VARCHAR(200),
      bio TEXT,
      location VARCHAR(100),
      profile_image_cid VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nonces (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(42) NOT NULL,
      nonce VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_nonces_wallet ON nonces(wallet_address)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS connections (
      id SERIAL PRIMARY KEY,
      requester_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
      recipient_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(requester_address, recipient_address)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_connections_recipient
      ON connections(recipient_address, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_connections_requester
      ON connections(requester_address, status)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      author_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
      content TEXT NOT NULL CHECK (char_length(content) <= 5000),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_address)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`DROP TABLE IF EXISTS posts`);
  await pool.query(`DROP TABLE IF EXISTS connections`);
  await pool.query(`DROP TABLE IF EXISTS nonces`);
  await pool.query(`DROP TABLE IF EXISTS users`);
}
