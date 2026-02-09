-- Migration: 005_fix_messages_book_columns
-- Ensure book_ids and book_catalogs columns are properly defined as JSONB
-- UP

-- Drop existing columns if they exist (in case they were created with wrong type)
ALTER TABLE messages DROP COLUMN IF EXISTS book_ids CASCADE;
ALTER TABLE messages DROP COLUMN IF EXISTS book_catalogs CASCADE;

-- Recreate book_ids column as JSONB
ALTER TABLE messages ADD COLUMN book_ids JSONB DEFAULT NULL;

-- Recreate book_catalogs column as JSONB  
ALTER TABLE messages ADD COLUMN book_catalogs JSONB DEFAULT NULL;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_messages_book_ids ON messages USING GIN (book_ids);
CREATE INDEX IF NOT EXISTS idx_messages_book_catalogs ON messages USING GIN (book_catalogs);

-- Add comments
COMMENT ON COLUMN messages.book_ids IS 'Array of book IDs displayed via displayBooks function';
COMMENT ON COLUMN messages.book_catalogs IS 'JSONB mapping of bookId to catalogId for each displayed book - enables detail fetching from correct catalog on resume';

-- DOWN

DROP INDEX IF EXISTS idx_messages_book_catalogs;
DROP INDEX IF EXISTS idx_messages_book_ids;
ALTER TABLE messages DROP COLUMN IF EXISTS book_catalogs;
ALTER TABLE messages DROP COLUMN IF EXISTS book_ids;
