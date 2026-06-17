# Forge

A competitive accountability platform. The leaderboard is the product; every
other surface serves the leaderboard's integrity. See
[`FORGE_MASTER_BUILD.md`](./FORGE_MASTER_BUILD.md) for the full build spec.

Stack: Next.js 15 (App Router, React 19, TS strict), Tailwind v4, Supabase
(Postgres + Auth + Storage), `sharp` for perceptual hashing. No ORM, no
NextAuth, no client-side data fetching for cacheable reads.

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
npm run typecheck      # tsc --noEmit
npm run build          # production build
```

## Environment

Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is
git-ignored — never commit real credentials.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser + server). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key. Server-only: signed-URL reads, pHash download, seeding. |
| `SUPERADMIN_EMAIL` | Email of the founding superadmin. Drives role bootstrapping (below). |

## Database setup

Run the migrations in order, then the data seed, then the bootstrap script:

```bash
# In the Supabase SQL editor (or via the CLI), run in order:
#   supabase/migrations/0001_init.sql
#   supabase/migrations/0002_functions.sql
#   supabase/migrations/0003_rls.sql
#   supabase/migrations/0004_storage.sql
#   supabase/seed.sql           # halls + the Exam Flame challenge (draft)

npm run seed                    # writes SUPERADMIN_EMAIL into app_config
```

Flip the challenge from `draft` to `active` at launch:

```sql
update challenges set status = 'active' where slug = 'exam-flame';
```

## Routes

| Route | Who |
|---|---|
| `/auth`, `/auth/verify` | Public — email OTP sign-in. |
| `/welcome` | Authed, no profile — profile completion. |
| `/exam-flame` | Authed — challenge join. |
| `/leaderboard`, `/submit`, `/you` | Enrolled participants (bottom tabs / left rail). |
| `/admin` | `admin` / `super_admin` — submission review queue. |

## Role bootstrapping

Forge avoids hardcoding admin emails in migrations. Instead:

1. `SUPERADMIN_EMAIL` is set in the environment (`.env.local` locally; the host's
   env in deployed environments).
2. `scripts/seed.ts` reads `SUPERADMIN_EMAIL` and writes it into the `app_config`
   table (`key = 'superadmin_email'`). It also immediately elevates the matching
   profile if that user has already signed in.
3. A `before insert or update` trigger on `profiles`
   (`bootstrap_superadmin_role()`, defined in `supabase/migrations/0002_functions.sql`)
   reads `app_config` and sets `role = 'super_admin'` whenever the profile's auth
   email matches.

**The result:** the first user who signs in with the email matching
`SUPERADMIN_EMAIL` is automatically elevated to `super_admin`. Every subsequent
sign-in for that email retains the role. No emails live in the migrations, so
each environment can bootstrap its own superadmin.

### Seeding

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
SUPERADMIN_EMAIL=... \
  npx tsx scripts/seed.ts
```

Run `supabase/seed.sql` against the database first (it creates `app_config`, the
bootstrap trigger, halls, and the Exam Flame challenge), then run the script
above to wire in the superadmin email.
