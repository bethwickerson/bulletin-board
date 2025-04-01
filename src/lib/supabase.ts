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
        eventsPerSecond: 1 // Reduced to absolute minimum to lower server load
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
        // Use longer timeouts and fewer retries for better reliability
        const maxAttempts = 3; // Reduced from 5 to avoid overwhelming the server
        const baseTimeout = 10000; // Start with a longer timeout (10 seconds)
        
        const fetchWithTimeout = (attempt = 1): Promise<Response> => {
          // Use a longer initial timeout to give the server more time to respond
          const timeout = Math.min(baseTimeout * attempt, 30000); // Cap at 30 seconds
          
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
              // Use a longer exponential backoff time
              const backoffTime = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
              console.log(`Retrying request in ${backoffTime}ms...`);
              return new Promise(resolve => 
                setTimeout(() => resolve(fetchWithTimeout(attempt + 1)), backoffTime)
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
