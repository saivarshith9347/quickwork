/**
 * Supabase Server Client
 *
 * Used ONLY in TanStack Start server functions (createServerFn, API routes).
 * Uses the SERVICE ROLE KEY — bypasses RLS — so NEVER import this on the client.
 *
 * Environment variables required (server-side only — NO VITE_ prefix):
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * SECURITY: The service role key must never be exposed to the browser.
 *   - Do NOT use VITE_ prefix (would be embedded in the client bundle).
 *   - Set in Vercel as "Server" environment variable (not "Browser").
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Track whether server credentials are configured
export const isServerSupabaseConfigured = !!(
  process.env["SUPABASE_URL"] && 
  process.env["SUPABASE_SERVICE_ROLE_KEY"]
);

/**
 * Create a Supabase server client with service role key.
 * 
 * @param throwOnMissing - If true, throws error when credentials missing. Default: true for server context.
 * @returns Supabase client or null if not configured and throwOnMissing is false
 */
export function createServerSupabaseClient(
  throwOnMissing = true
): SupabaseClient<Database> | null {
  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !serviceRoleKey) {
    if (throwOnMissing) {
      throw new Error(
        "[QuickWork Server] Missing Supabase server environment variables.\n" +
          "Set (WITHOUT VITE_ prefix):\n" +
          "  SUPABASE_URL=https://<project-ref>.supabase.co\n" +
          "  SUPABASE_SERVICE_ROLE_KEY=eyJ...",
      );
    }
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      // Service role client should not persist sessions
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
