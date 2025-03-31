/*
  # Enable realtime functionality for notes table
  
  This migration enables realtime functionality for the notes table,
  which is required for the real-time subscription to work.
*/

-- Enable realtime for the notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

-- Ensure the table has replica identity
ALTER TABLE notes REPLICA IDENTITY FULL;
