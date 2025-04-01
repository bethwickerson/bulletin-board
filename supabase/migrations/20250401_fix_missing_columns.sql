/*
  # Fix missing columns in notes table
  
  This migration ensures the width, height, and rotation columns exist in the notes table.
  It uses IF NOT EXISTS to avoid errors if the columns already exist.
*/

-- Check if width column exists, add if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notes' AND column_name = 'width'
    ) THEN
        ALTER TABLE notes ADD COLUMN width INTEGER;
    END IF;
END $$;

-- Check if height column exists, add if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notes' AND column_name = 'height'
    ) THEN
        ALTER TABLE notes ADD COLUMN height INTEGER;
    END IF;
END $$;

-- Check if rotation column exists, add if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notes' AND column_name = 'rotation'
    ) THEN
        ALTER TABLE notes ADD COLUMN rotation INTEGER;
    END IF;
END $$;

-- Set default values for existing notes
UPDATE notes
SET width = 256, 
    height = 256, 
    rotation = 0
WHERE width IS NULL OR height IS NULL OR rotation IS NULL;
