-- Forge — initial schema (§8)
-- All tables in public unless noted. Postgres. UUIDs except stable text slugs.

create extension if not exists "pgcrypto";

-- Runtime key/value config (e.g. superadmin_email). Read by triggers/app.
create table if not exists app_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

create table if not exists halls (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text not null,
  hall_id            uuid references halls(id),
  course             text not null,
  academic_level     text,
  phone              text,
  avatar_url         text,
  role               text not null default 'participant'
                     check (role in ('participant','admin','super_admin')),
  is_suspended       boolean not null default false,
  suspension_reason  text,
  created_at         timestamptz not null default now()
);

create table if not exists challenges (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  name                  text not null,
  description           text,
  rules                 text,
  start_date            date not null,
  end_date              date not null,
  duration_days         int generated always as ((end_date - start_date) + 1) stored,
  prize_structure       jsonb not null default '[]'::jsonb,
  prize_line_position   int not null default 15,
  ranking_rule          text not null default 'hours_then_days_then_earliest',
  status                text not null default 'draft'
                        check (status in ('draft','active','verification','completed','archived')),
  timezone              text not null default 'Africa/Lagos',
  daily_hour_ceiling    numeric(4,1) not null default 24.0,
  submission_window_hrs int not null default 36,
  created_at            timestamptz not null default now()
);

create table if not exists challenge_participants (
  id                       uuid primary key default gen_random_uuid(),
  challenge_id             uuid not null references challenges(id) on delete cascade,
  participant_id           uuid not null references profiles(id) on delete cascade,
  joined_at                timestamptz not null default now(),
  rules_accepted_at        timestamptz not null,
  is_disqualified          boolean not null default false,
  disqualification_reason  text,
  disqualified_at          timestamptz,
  disqualified_by          uuid references profiles(id),
  flag_count               int not null default 0,
  unique (challenge_id, participant_id)
);

create table if not exists submissions (
  id                    uuid primary key default gen_random_uuid(),
  challenge_id          uuid not null references challenges(id),
  participant_id        uuid not null references profiles(id),
  challenge_day         int not null,
  hours_claimed         numeric(4,1) not null check (hours_claimed > 0 and hours_claimed <= 24),
  hours_credited        numeric(4,1),
  topic                 text not null,
  screenshot_path       text not null,
  screenshot_phash      text not null,
  ocr_extracted_hours   numeric(4,1),
  whatsapp_post_time    text,
  status                text not null default 'pending'
                        check (status in ('pending','confirmed','rejected')),
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid references profiles(id),
  rejection_reason      text,
  internal_notes        text,
  flag_reasons          text[] not null default '{}',
  client_ip             inet,
  client_fingerprint    text,
  unique (challenge_id, participant_id, challenge_day)
);

create index if not exists idx_submissions_challenge_status
  on submissions (challenge_id, status);
create index if not exists idx_submissions_participant
  on submissions (participant_id, challenge_id);

create table if not exists appeals (
  id                       uuid primary key default gen_random_uuid(),
  submission_id            uuid not null references submissions(id),
  participant_explanation  text not null,
  additional_evidence_path text,
  status                   text not null default 'pending'
                           check (status in ('pending','upheld','restored')),
  created_at               timestamptz not null default now(),
  resolved_at              timestamptz,
  resolved_by              uuid references profiles(id)
);

create table if not exists audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references profiles(id),
  action          text not null,
  entity_type     text not null,
  entity_id       uuid not null,
  previous_state  jsonb,
  new_state       jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id),
  name       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leaderboard_snapshots (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id),
  taken_at     timestamptz not null default now(),
  rankings     jsonb not null
);

create index if not exists idx_snapshots_challenge_taken
  on leaderboard_snapshots (challenge_id, taken_at desc);
