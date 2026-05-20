import { createBrowserClient } from '@supabase/ssr'

/**
 * Client-side Supabase client.
 * Use this ONLY in 'use client' components.
 * Uses the ANON key — RLS policies enforce access control.
 * SERVICE_ROLE_KEY is NEVER used here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
