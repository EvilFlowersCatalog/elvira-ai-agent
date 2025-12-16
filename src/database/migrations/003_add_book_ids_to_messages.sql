-- Migration: 003_add_book_ids_to_messages
-- Add bookIds column to messages table to store book IDs from displayBooks function
-- UP

-- Add bookIds column as JSONB array to store book IDs
ALTER TABLE messages ADD COLUMN IF NOT EXISTS book_ids JSONB DEFAULT NULL;

-- Create index for querying messages with book IDs
CREATE INDEX IF NOT EXISTS idx_messages_book_ids ON messages USING GIN (book_ids);

-- Add comment to document the column
COMMENT ON COLUMN messages.book_ids IS 'Array of book IDs displayed via displayBooks function';

-- DOWN

DROP INDEX IF EXISTS idx_messages_book_ids;
ALTER TABLE messages DROP COLUMN IF EXISTS book_ids;
