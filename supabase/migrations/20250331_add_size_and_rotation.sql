-- Add width, height, and rotation columns to the notes table
ALTER TABLE notes
ADD COLUMN width INTEGER,
ADD COLUMN height INTEGER,
ADD COLUMN rotation INTEGER;

-- Set default values for existing notes
UPDATE notes
SET width = 256, 
    height = NULL, 
    rotation = -1
WHERE width IS NULL;
