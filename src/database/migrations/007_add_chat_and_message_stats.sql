-- Migration: 007_add_chat_and_message_stats
-- UP

-- Add total_tokens and message_count columns to chats table to track statistics
ALTER TABLE chats
ADD COLUMN IF NOT EXISTS total_tokens BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS message_count INT DEFAULT 0;

-- Create indexes for faster aggregation queries
CREATE INDEX IF NOT EXISTS idx_chats_total_tokens ON chats(total_tokens);
CREATE INDEX IF NOT EXISTS idx_chats_message_count ON chats(message_count);

-- Update existing chats with current statistics
UPDATE chats c
SET 
  total_tokens = COALESCE((
    SELECT SUM(tokens_used) 
    FROM messages m 
    WHERE m.chat_id = c.id
  ), 0),
  message_count = COALESCE((
    SELECT COUNT(*) 
    FROM messages m 
    WHERE m.chat_id = c.id
  ), 0);

-- Create a function to auto-generate chat titles from first message
CREATE OR REPLACE FUNCTION generate_chat_title_from_first_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update title if it's null and this is a user message
  IF NEW.sender = 'user' THEN
    UPDATE chats 
    SET title = LEFT(NEW.text, 100)
    WHERE id = NEW.chat_id 
      AND (title IS NULL OR title = '')
      AND NOT EXISTS (
        SELECT 1 FROM messages 
        WHERE chat_id = NEW.chat_id 
        AND id != NEW.id
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate title from first user message
DROP TRIGGER IF EXISTS trigger_generate_chat_title ON messages;
CREATE TRIGGER trigger_generate_chat_title
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION generate_chat_title_from_first_message();

-- Create a function to update chat statistics when messages are inserted/updated
CREATE OR REPLACE FUNCTION update_chat_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment message count and add tokens
    UPDATE chats 
    SET 
      message_count = message_count + 1,
      total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update tokens (the difference between old and new)
    UPDATE chats 
    SET 
      total_tokens = total_tokens - COALESCE(OLD.tokens_used, 0) + COALESCE(NEW.tokens_used, 0),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement message count and subtract tokens
    UPDATE chats 
    SET 
      message_count = message_count - 1,
      total_tokens = total_tokens - COALESCE(OLD.tokens_used, 0),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.chat_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update chat statistics
DROP TRIGGER IF EXISTS trigger_update_chat_statistics ON messages;
CREATE TRIGGER trigger_update_chat_statistics
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_statistics();

-- DOWN

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_chat_statistics ON messages;
DROP TRIGGER IF EXISTS trigger_generate_chat_title ON messages;

-- Drop functions
DROP FUNCTION IF EXISTS update_chat_statistics();
DROP FUNCTION IF EXISTS generate_chat_title_from_first_message();

-- Drop indexes
DROP INDEX IF EXISTS idx_chats_message_count;
DROP INDEX IF EXISTS idx_chats_total_tokens;

-- Drop columns
ALTER TABLE chats
DROP COLUMN IF EXISTS message_count,
DROP COLUMN IF EXISTS total_tokens;
