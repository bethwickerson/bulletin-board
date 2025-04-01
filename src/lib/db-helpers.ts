import { supabase } from './supabase';
import { cache } from './cache';
import type { Database } from './database.types';

// Type for notes table
type Note = Database['public']['Tables']['notes']['Row'];

/**
 * Fetch notes with pagination and caching
 * @param page Page number (0-based)
 * @param pageSize Number of notes per page
 * @param useCache Whether to use cache
 * @returns Array of notes
 */
export async function fetchNotes(
  page = 0,
  pageSize = 20,
  useCache = true
): Promise<Note[]> {
  const cacheKey = `notes_page_${page}_${pageSize}`;
  
  // Try to get from cache first
  if (useCache && cache.has(cacheKey)) {
    console.log(`Using cached notes for page ${page}`);
    return cache.get<Note[]>(cacheKey) || [];
  }
  
  try {
    // Calculate range for pagination
    const start = page * pageSize;
    const end = start + pageSize - 1;
    
    // Fetch notes from Supabase
    const { data, error } = await supabase
      .from('notes')
      .select('id, content, position_x, position_y, author, color, type, meme_url, created_at, width, height, rotation')
      .order('created_at', { ascending: false })
      .range(start, end);
      
    if (error) {
      console.error(`Error fetching notes page ${page}:`, error);
      return [];
    }
    
    if (!data) {
      return [];
    }
    
    // Cache the results
    cache.set(cacheKey, data, 60 * 1000); // Cache for 60 seconds
    
    return data;
  } catch (error) {
    console.error('Unexpected error in fetchNotes:', error);
    return [];
  }
}

/**
 * Get the total count of notes
 * @param useCache Whether to use cache
 * @returns Total count of notes
 */
export async function getNotesCount(useCache = true): Promise<number> {
  const cacheKey = 'notes_count';
  
  // Try to get from cache first
  if (useCache && cache.has(cacheKey)) {
    console.log('Using cached notes count');
    return cache.get<number>(cacheKey) || 0;
  }
  
  try {
    const { count, error } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true });
      
    if (error) {
      console.error('Error getting notes count:', error);
      return 0;
    }
    
    // Cache the result
    if (count !== null) {
      cache.set(cacheKey, count, 60 * 1000); // Cache for 60 seconds
    }
    
    return count || 0;
  } catch (error) {
    console.error('Unexpected error in getNotesCount:', error);
    return 0;
  }
}

/**
 * Add a new note
 * @param note Note data to insert
 * @returns The inserted note or null if error
 */
export async function addNote(
  note: Database['public']['Tables']['notes']['Insert']
): Promise<Note | null> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert([note])
      .select();
      
    if (error) {
      console.error('Error adding note:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      return null;
    }
    
    // Invalidate cache for notes
    invalidateNotesCache();
    
    return data[0] as Note;
  } catch (error) {
    console.error('Unexpected error in addNote:', error);
    return null;
  }
}

/**
 * Update a note
 * @param id Note ID
 * @param updates Fields to update
 * @returns True if successful
 */
export async function updateNote(
  id: string,
  updates: Database['public']['Tables']['notes']['Update']
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id);
      
    if (error) {
      console.error('Error updating note:', error);
      return false;
    }
    
    // Invalidate cache for notes
    invalidateNotesCache();
    
    return true;
  } catch (error) {
    console.error('Unexpected error in updateNote:', error);
    return false;
  }
}

/**
 * Delete a note
 * @param id Note ID
 * @returns True if successful
 */
export async function deleteNote(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting note:', error);
      return false;
    }
    
    // Invalidate cache for notes
    invalidateNotesCache();
    
    return true;
  } catch (error) {
    console.error('Unexpected error in deleteNote:', error);
    return false;
  }
}

/**
 * Invalidate all notes-related cache entries
 */
export function invalidateNotesCache(): void {
  // Clear all cache entries that start with 'notes_'
  // Use a different approach to avoid accessing private property
  const cacheKeys = ['notes_count'];
  // Add page cache keys for the first 10 pages (reasonable assumption)
  for (let i = 0; i < 10; i++) {
    cacheKeys.push(`notes_page_${i}_20`);
  }
  
  // Clear all identified cache keys
  cacheKeys.forEach(key => cache.remove(key));
}
