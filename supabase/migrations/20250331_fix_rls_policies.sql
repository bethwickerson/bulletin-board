/*
  # Fix RLS policies for notes table
  
  This migration:
  1. Drops existing RLS policies
  2. Creates new policies that allow public access for all operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON notes;
DROP POLICY IF EXISTS "Allow authenticated insert" ON notes;
DROP POLICY IF EXISTS "Allow public insert" ON notes;
DROP POLICY IF EXISTS "Allow public update" ON notes;

-- Create new policies with public access
CREATE POLICY "Allow public read access"
  ON notes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert"
  ON notes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON notes
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete"
  ON notes
  FOR DELETE
  TO public
  USING (true);
