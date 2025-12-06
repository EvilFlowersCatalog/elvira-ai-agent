#!/usr/bin/env ts-node
/**
 * Database Migration CLI
 * Usage:
 *   npm run migrate          - Run pending migrations
 *   npm run migrate:rollback - Rollback last migration
 *   npm run migrate:reset    - Rollback all and re-run
 */

import { Pool } from 'pg';
import { getDatabaseConfig } from '../database/config';
import { runMigrations, rollbackMigration, loadMigrations, MIGRATIONS_TABLE_NAME } from '../database/migrations';

const command = process.argv[2] || 'up';

async function main() {
  const config = getDatabaseConfig();

  if (config.storageType === 'local') {
    console.log('Migrations are not applicable for local storage');
    process.exit(0);
  }

  if (!config.postgres) {
    throw new Error('PostgreSQL config is required');
  }

  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    user: config.postgres.user,
    password: config.postgres.password,
    database: config.postgres.database,
  });

  try {
    switch (command) {
      case 'up':
        await runMigrations(pool);
        break;
      case 'down':
      case 'rollback':
        await rollbackMigration(pool);
        break;
      case 'reset':
        console.log('Resetting all migrations...');
        let hasMore = true;
        while (hasMore) {
          const migrations = loadMigrations();
          const result = await pool.query(`SELECT COUNT(*) FROM ${MIGRATIONS_TABLE_NAME}`);
          hasMore = parseInt(result.rows[0].count) > 0;
          if (hasMore) {
            await rollbackMigration(pool);
          }
        }
        console.log('All migrations rolled back. Re-running...');
        await runMigrations(pool);
        break;
      case 'status':
        const migrations = loadMigrations();
        const result = await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE_NAME} ORDER BY executed_at`);
        const executed = new Set(result.rows.map((r) => r.name));
        console.log('Migration Status:');
        for (const migration of migrations) {
          const status = executed.has(migration.name) ? '✓' : '✗';
          console.log(`  ${status} ${migration.name}`);
        }
        break;
      default:
        console.log('Unknown command:', command);
        console.log('Available commands: up, down, rollback, reset, status');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
