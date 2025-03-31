/*
  # Birthday Board Schema

  1. Tables
    - `notes` table for storing birthday messages and memes
      - `id` (uuid, primary key)
      - `content` (text) - message content or meme prompt
      - `position_x` (float) - x coordinate on board
      - `position_y` (float) - y coordinate on board
      - `author` (text) - name of message author
      - `color` (text) - post-it note color
      - `type` (text) - 'text' or 'meme'
      - `meme_url` (text, optional) - URL of generated meme
      - `created_at` (timestamptz) - creation timestamp

  2. Security
    - Enable RLS on `notes` table
    - Allow public access for read and write operations
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

-- Allow anyone to read notes
CREATE POLICY "Allow public read access"
  ON notes
  FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert notes
CREATE POLICY "Allow public insert"
  ON notes
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to update their notes
CREATE POLICY "Allow public update"
  ON notes
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);