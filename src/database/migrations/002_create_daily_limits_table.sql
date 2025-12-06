-- Migration: 002_create_daily_limits_table
-- UP

-- Create daily_limits table for tracking usage
CREATE TABLE IF NOT EXISTS daily_limits (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  messages_used INT DEFAULT 0,
  messages_limit INT DEFAULT 100,
  tokens_used INT DEFAULT 0,
  tokens_limit INT DEFAULT 50000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, date)
);

-- Create index for fast lookup of today's limit
CREATE INDEX IF NOT EXISTS idx_daily_limits_user_id_date ON daily_limits(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_limits_date ON daily_limits(date);

-- DOWN

DROP INDEX IF EXISTS idx_daily_limits_date;
DROP INDEX IF EXISTS idx_daily_limits_user_id_date;
DROP TABLE IF EXISTS daily_limits;
