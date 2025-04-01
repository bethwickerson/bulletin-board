import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Ensure environment variables are defined
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    realtime: {
      params: {
        eventsPerSecond: 5 // Reduced from 10 to lower server load
      }
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'x-application-name': 'bulletin-board-app'
      },
      // Add fetch options with timeout and retry logic
      fetch: (url, options) => {
        // Use shorter timeouts and more retries for production
        const maxAttempts = 5;
        const baseTimeout = 3000; // Start with a shorter timeout
        
        const fetchWithTimeout = (attempt = 1): Promise<Response> => {
          // Use a shorter initial timeout and increase more gradually
          const timeout = Math.min(baseTimeout * attempt, 10000); // Cap at 10 seconds
          
          console.log(`Attempt ${attempt}/${maxAttempts} with timeout ${timeout}ms`);
          
          return Promise.race([
            fetch(url, {
              ...options,
              signal: undefined // Remove existing signal if any
            }),
            new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms`)), timeout)
            )
          ]).catch(error => {
            console.error(`Request failed (attempt ${attempt}/${maxAttempts}):`, error.message);
            
            if (attempt < maxAttempts) {
              console.log(`Retrying request in ${attempt * 500}ms...`);
              // Use a shorter backoff time
              return new Promise(resolve => 
                setTimeout(() => resolve(fetchWithTimeout(attempt + 1)), attempt * 500)
              );
            }
            
            // If we've exhausted all retries, throw a more descriptive error
            if (error.message.includes('timeout')) {
              throw new Error(`Database connection timed out after ${maxAttempts} attempts. Please try again later.`);
            }
            throw error;
          });
        };
        
        return fetchWithTimeout();
      }
    }
  }
);
