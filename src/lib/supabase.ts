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
        const fetchWithTimeout = (attempt = 1, maxAttempts = 3): Promise<Response> => {
          const timeout = attempt * 5000; // Increase timeout with each retry
          
          return Promise.race([
            fetch(url, {
              ...options,
              signal: undefined // Remove existing signal if any
            }),
            new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms`)), timeout)
            )
          ]).catch(error => {
            if (attempt < maxAttempts) {
              console.log(`Retrying request (${attempt}/${maxAttempts})...`);
              return fetchWithTimeout(attempt + 1, maxAttempts);
            }
            throw error;
          });
        };
        
        return fetchWithTimeout();
      }
    }
  }
);
