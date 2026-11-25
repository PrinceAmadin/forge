"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sign-out runs server-side so the httpOnly session cookies are actually
// cleared (the browser can't touch them). Single tap, no confirmation. §13
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}
