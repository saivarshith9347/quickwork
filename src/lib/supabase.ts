/// <reference types="vite/client" />

/**
 * Supabase Browser Client
 *
 * Used in all client-side code (React components, hooks, route loaders).
 * Uses the anon key — enforces RLS policies on every operation.
 *
 * Environment variables required (set in .env.local):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJ...
 *
 * IMPORTANT: This module now exports lazy-initialized client to prevent
 * startup crashes when credentials are missing. Use getSupabase() or
 * handle the null case when accessing supabase directly.
 */

import { createClient, type SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as
  | string
  | undefined;

// Track whether credentials are configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Lazy-initialized client (null if not configured)
let _supabaseClient: SupabaseClientType<Database> | null = null;

/**
 * Get the Supabase client instance.
 * Returns null if credentials are not configured.
 * 
 * @throws {Error} if throwOnMissing is true and credentials are not configured
 */
export function getSupabase(throwOnMissing = false): SupabaseClientType<Database> | null {
  if (!isSupabaseConfigured) {
    if (throwOnMissing) {
      throw new Error(
        "[QuickWork] Missing Supabase credentials.\n" +
          "Set in .env.local:\n" +
          "  VITE_SUPABASE_URL=https://<project-ref>.supabase.co\n" +
          "  VITE_SUPABASE_ANON_KEY=eyJ...\n" +
          "Then restart the dev server.",
      );
    }
    return null;
  }

  // Lazy initialization
  if (!_supabaseClient) {
    _supabaseClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return _supabaseClient;
}

/**
 * Legacy export for backwards compatibility.
 * IMPORTANT: This will be null if Supabase is not configured.
 * Prefer using getSupabase() for better error handling.
 */
export const supabase = getSupabase();

export type SupabaseClient = SupabaseClientType<Database>;

/**
 * Configuration error message component data.
 * Use this to display a user-friendly configuration prompt.
 */
export const SUPABASE_CONFIG_ERROR = {
  title: "Supabase Configuration Required",
  message: "QuickWork requires Supabase credentials to function.",
  instructions: [
    "1. Go to https://supabase.com/dashboard",
    "2. Select your project",
    "3. Go to Settings → API",
    "4. Copy the Project URL and anon public key",
    "5. Create a .env.local file in the project root",
    "6. Add the following:",
    "   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co",
    "   VITE_SUPABASE_ANON_KEY=eyJ...",
    "7. Restart the development server",
  ],
} as const;
