/**
 * scripts/seed.ts
 *
 * Bootstraps the superadmin without hardcoding an email in any migration.
 *
 * Reads SUPERADMIN_EMAIL from the environment and:
 *   1. Writes it into the app_config table (key = 'superadmin_email'), which the
 *      bootstrap_superadmin_role() trigger reads when a profile is created. This
 *      auto-elevates the user the first time they sign in.
 *   2. If a profile for that email already exists (the user signed in before the
 *      config was set), elevates it immediately via UPSERT.
 *
 * Run with the service-role key so RLS does not block the writes:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPERADMIN_EMAIL=... \
 *     npx tsx scripts/seed.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("SUPABASE_URL", SUPABASE_URL);
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
  const email = requireEnv("SUPERADMIN_EMAIL", SUPERADMIN_EMAIL).trim().toLowerCase();

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Make the email available to the bootstrap trigger for future sign-ins.
  const { error: configError } = await supabase
    .from("app_config")
    .upsert(
      { key: "superadmin_email", value: email, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (configError) {
    console.error("Failed to write superadmin_email to app_config:", configError.message);
    process.exit(1);
  }
  console.log(`app_config.superadmin_email set to ${email}`);

  // 2. Elevate immediately if the user has already signed in.
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list auth users:", listError.message);
    process.exit(1);
  }

  const existing = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) {
    console.log("No existing auth user for that email yet — they will be elevated on first sign-in.");
    return;
  }

  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "super_admin" })
    .eq("id", existing.id);

  if (roleError) {
    console.error("Failed to elevate existing profile:", roleError.message);
    process.exit(1);
  }
  console.log(`Existing profile ${existing.id} elevated to superadmin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
