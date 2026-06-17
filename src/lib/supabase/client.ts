"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Browser Supabase client — used only where genuine client interactivity
// demands it (OTP entry, direct-to-storage uploads). Reads are server-side.
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
