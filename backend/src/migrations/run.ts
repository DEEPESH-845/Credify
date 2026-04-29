import pool from "../config/database";
import * as initialSchema from "./001_initial_schema";

interface Migration {
  name: string;
  up: (pool: typeof import("pg").Pool.prototype) => Promise<void>;
  down: (pool: typeof import("pg").Pool.prototype) => Promise<void>;
}

const migrations: Migration[] = [
  {
    name: "001_initial_schema",
    up: initialSchema.up,
    down: initialSchema.down,
  },
];

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query(
    `SELECT name FROM migrations ORDER BY id ASC`
  );
  return result.rows.map((row: { name: string }) => row.name);
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  for (const migration of migrations) {
    if (executed.includes(migration.name)) {
      console.log(`Skipping already executed migration: ${migration.name}`);
      continue;
    }

    console.log(`Running migration: ${migration.name}`);
    await migration.up(pool);
    await pool.query(`INSERT INTO migrations (name) VALUES ($1)`, [
      migration.name,
    ]);
    console.log(`Completed migration: ${migration.name}`);
  }
}

async function rollbackMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const executed = await getExecutedMigrations();

  for (const migration of [...migrations].reverse()) {
    if (!executed.includes(migration.name)) {
      console.log(`Skipping non-executed migration: ${migration.name}`);
      continue;
    }

    console.log(`Rolling back migration: ${migration.name}`);
    await migration.down(pool);
    await pool.query(`DELETE FROM migrations WHERE name = $1`, [
      migration.name,
    ]);
    console.log(`Rolled back migration: ${migration.name}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    if (command === "down" || command === "rollback") {
      await rollbackMigrations();
    } else {
      await runMigrations();
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
