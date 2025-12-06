/**
 * Migration runner - executes SQL migration files
 */
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export const MIGRATIONS_TABLE_NAME = 'assistant_migrations';

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
}

/**
 * Load all migration files from the migrations directory
 */
export function loadMigrations(): Migration[] {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const migrations: Migration[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    const parts = content.split('-- DOWN');

    if (parts.length !== 2) {
      console.warn(`Invalid migration file format: ${file}`);
      continue;
    }

    const id = file.replace('.sql', '');
    const up = parts[0].replace('-- UP', '').trim();
    const down = parts[1].trim();

    migrations.push({ id, name: file, up, down });
  }

  return migrations.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Run all pending migrations
 */
export async function runMigrations(pool: Pool): Promise<void> {
  console.log('Running migrations...');

  // Create migrations table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrations = loadMigrations();
  const result = await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE_NAME}`);
  const executedMigrations = new Set(result.rows.map((r) => r.name));

  for (const migration of migrations) {
    if (executedMigrations.has(migration.name)) {
      console.log(`✓ Skipping migration: ${migration.name}`);
      continue;
    }

    try {
      console.log(`Executing migration: ${migration.name}`);
      await pool.query(migration.up);
      await pool.query(`INSERT INTO ${MIGRATIONS_TABLE_NAME} (name) VALUES ($1)`, [migration.name]);
      console.log(`✓ Completed migration: ${migration.name}`);
    } catch (error) {
      console.error(`✗ Failed to run migration ${migration.name}:`, error);
      throw error;
    }
  }

  console.log('Migrations completed!');
}

/**
 * Rollback the last migration
 */
export async function rollbackMigration(pool: Pool): Promise<void> {
  const result = await pool.query(`
    SELECT name FROM ${MIGRATIONS_TABLE_NAME} ORDER BY executed_at DESC LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('No migrations to rollback');
    return;
  }

  const lastMigration = result.rows[0].name;
  const migrations = loadMigrations();
  const migration = migrations.find((m) => m.name === lastMigration);

  if (!migration) {
    console.error(`Migration file not found: ${lastMigration}`);
    return;
  }

  try {
    console.log(`Rollback migration: ${lastMigration}`);
    await pool.query(migration.down);
    await pool.query(`DELETE FROM ${MIGRATIONS_TABLE_NAME} WHERE name = $1`, [lastMigration]);
    console.log(`✓ Rollback completed: ${lastMigration}`);
  } catch (error) {
    console.error(`✗ Failed to rollback migration ${lastMigration}:`, error);
    throw error;
  }
}
