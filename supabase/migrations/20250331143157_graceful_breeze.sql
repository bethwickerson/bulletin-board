/*
  # Create notes table for birthday messages

  1. New Tables
    - `notes`
      - `id` (uuid, primary key)
      - `content` (text)
      - `position_x` (float)
      - `position_y` (float)
      - `author` (text)
      - `color` (text)
      - `type` (text)
      - `meme_url` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `notes` table
    - Add policy for public read access
    - Add policy for authenticated users to create notes
*/

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  position_x float NOT NULL,
  position_y float NOT NULL,
  author text NOT NULL,
  color text NOT NULL,
  type text NOT NULL,
  meme_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON notes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated insert"
  ON notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);