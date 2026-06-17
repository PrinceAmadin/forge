function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  // Service-role key is server-only; never reference from a Client Component.
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export const ACTIVE_CHALLENGE_SLUG = "exam-flame";
