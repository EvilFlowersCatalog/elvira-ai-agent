/**
 * Database factory - creates the appropriate adapter based on configuration
 */
import { DatabaseAdapter } from './adapter';
import { getDatabaseConfig } from './config';
import { LocalDatabaseAdapter } from './adapters/localAdapter';
import { PostgresDatabaseAdapter } from './adapters/postgresAdapter';

let dbAdapter: DatabaseAdapter | null = null;

/**
 * Initialize and get the database adapter
 */
export async function initializeDatabase(): Promise<DatabaseAdapter> {
  if (dbAdapter) {
    return dbAdapter;
  }

  const config = getDatabaseConfig();

  if (config.storageType === 'postgres') {
    console.log('Using PostgreSQL database');
    dbAdapter = new PostgresDatabaseAdapter(config);
  } else {
    console.log('Using local in-memory database');
    dbAdapter = new LocalDatabaseAdapter();
  }

  await dbAdapter.init();
  return dbAdapter;
}

/**
 * Get the current database adapter
 */
export function getDatabaseAdapter(): DatabaseAdapter {
  if (!dbAdapter) {
    throw new Error('Database adapter not initialized. Call initializeDatabase() first.');
  }
  return dbAdapter;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbAdapter) {
    await dbAdapter.close();
    dbAdapter = null;
  }
}

export { DatabaseAdapter, DailyLimit } from './adapter';
