/**
 * Database configuration based on environment variables
 */
export type StorageType = 'local' | 'postgres';

export interface DatabaseConfig {
  storageType: StorageType;
  postgres?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const storageType = (process.env.DB_STORAGE || 'local') as StorageType;

  if (storageType === 'postgres') {
    return {
      storageType,
      postgres: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'elvira_user',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'elvira_agent',
      },
    };
  }

  return { storageType: 'local' };
}

export function getDailyLimitConfig() {
  return {
    messagesPerDay: parseInt(process.env.DAILY_LIMIT_MESSAGES || '100', 10),
    tokensPerDay: parseInt(process.env.DAILY_LIMIT_TOKENS || '50000', 10),
    resetHour: parseInt(process.env.DAILY_LIMIT_RESET_HOUR || '0', 10),
  };
}
