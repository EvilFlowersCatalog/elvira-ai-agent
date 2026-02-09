-- Migration: 006_fix_book_columns_types
-- Force fix book_ids and book_catalogs columns to be JSONB
-- UP

-- Drop and recreate columns with correct JSONB type
DO $$ 
BEGIN
    -- Drop book_ids if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'book_ids'
    ) THEN
        ALTER TABLE messages DROP COLUMN book_ids CASCADE;
    END IF;
    
    -- Drop book_catalogs if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'book_catalogs'
    ) THEN
        ALTER TABLE messages DROP COLUMN book_catalogs CASCADE;
    END IF;
END $$;

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
