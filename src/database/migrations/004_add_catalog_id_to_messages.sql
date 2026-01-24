-- Migration: 004_add_catalog_id_to_messages
-- Add book_catalogs JSONB column to messages table to store bookId->catalogId mapping
-- UP

-- Add book_catalogs column to store mapping of bookId -> catalogId for each displayed book
ALTER TABLE messages ADD COLUMN IF NOT EXISTS book_catalogs JSONB DEFAULT NULL;

-- Create GIN index for efficient JSONB querying
CREATE INDEX IF NOT EXISTS idx_messages_book_catalogs ON messages USING GIN (book_catalogs);

-- Add comment to document the column
COMMENT ON COLUMN messages.book_catalogs IS 'JSONB mapping of bookId to catalogId for each displayed book - enables detail fetching from correct catalog on resume';

-- DOWN

DROP INDEX IF EXISTS idx_messages_book_catalogs;
ALTER TABLE messages DROP COLUMN IF EXISTS book_catalogs;
