-- Migration: 001_create_initial_schema
-- UP

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  surname VARCHAR(255) NOT NULL,
  is_superuser BOOLEAN DEFAULT FALSE,
  permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  catalog_permissions JSONB DEFAULT '{}',
  blocked BOOLEAN DEFAULT FALSE,
  blocked_until TIMESTAMP,
  blocked_reason VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(500),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id and created_at for chat history queries
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_is_active ON chats(is_active);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  chat_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'agent')),
  text TEXT NOT NULL,
  entry_id VARCHAR(36),
  msg_id VARCHAR(36),
  weight DECIMAL(5, 2) DEFAULT 1.0,
  tokens_used INT DEFAULT 0,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create index on chat_id and user_id for message retrieval
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);

-- DOWN

DROP INDEX IF EXISTS idx_messages_sender;
DROP INDEX IF EXISTS idx_messages_timestamp;
DROP INDEX IF EXISTS idx_messages_user_id;
DROP INDEX IF EXISTS idx_messages_chat_id;
DROP TABLE IF EXISTS messages;

DROP INDEX IF EXISTS idx_chats_is_active;
DROP INDEX IF EXISTS idx_chats_created_at;
DROP INDEX IF EXISTS idx_chats_user_id;
DROP TABLE IF EXISTS chats;

DROP INDEX IF EXISTS idx_users_created_at;
DROP INDEX IF EXISTS idx_users_username;
DROP TABLE IF EXISTS users;
