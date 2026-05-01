import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "blockchain_social",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  // Use connection string if provided (e.g. Neon, Supabase)
  connectionString: process.env.DATABASE_URL || undefined,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

export default pool;
