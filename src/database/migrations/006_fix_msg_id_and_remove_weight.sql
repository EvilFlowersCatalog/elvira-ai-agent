-- Migration: 006_fix_msg_id_and_remove_weight
-- Fix msg_id column length and remove weight column
-- UP

-- Expand msg_id to accommodate longer OpenAI message IDs
ALTER TABLE messages ALTER COLUMN msg_id TYPE VARCHAR(255);

-- Drop weight column (no longer used)
ALTER TABLE messages DROP COLUMN IF EXISTS weight;

-- DOWN

ALTER TABLE messages ALTER COLUMN msg_id TYPE VARCHAR(36);
ALTER TABLE messages ADD COLUMN weight DECIMAL(5, 2) DEFAULT 1.0;
