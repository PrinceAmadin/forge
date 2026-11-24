-- Forge — multi-challenge platform columns (Phase 1.2)
--
-- Purely additive. Every column is either nullable or has a default, so this
-- cannot fail against existing rows and needs no downtime. The two backfill
-- statements are guarded with `where ... is null`, so the whole file is
-- re-runnable.
--
-- NUMBERING: the plan called this 0015 back when 0013 was going to be the
-- migration ledger. 0013 ended up being the integrity fixes, so this is 0014
-- and the ledger takes a later number.
--
-- NOT YET APPLIED when this was written: 0013 is also still pending. Apply in
-- order, 0013 then 0014.

-- ---------------------------------------------------------------------------
-- 1. Rewards. Not every challenge pays money.
--
-- reward_kind is the authority on whether money appears in the UI at all:
--   cash   — tiers in prize_structure carry `amount` in naira (every row today)
--   none   — a friendly challenge: no pool, no money anywhere
--   custom — a trophy, a certificate, bragging rights; described in prose
--
-- DELIBERATELY NOT CHANGED: prize_line_position keeps its `not null default
-- 15`. The cut and the money are now independent concepts — a friendly
-- challenge still has an HONOURS line ("top 20", nothing behind it), which is
-- the useful default. Making the column nullable would force every one of the
-- ~15 leaderboard call sites that treat prizeLine as a number to handle null,
-- for a "no cut at all" case nothing can currently create. If that case is ever
-- wanted, it is a self-contained follow-up; lib/challenge.ts prizeLine()
-- already returns `number | null` so the lib side is ready.
-- ---------------------------------------------------------------------------
alter table challenges
  add column if not exists reward_kind text not null default 'cash',
  add column if not exists prize_note  text;

comment on column challenges.reward_kind is
  'cash | none | custom — whether and how this challenge rewards winners. Constrained in 0016.';
comment on column challenges.prize_note is
  'Free-text reward for a non-cash challenge, e.g. "A trophy and eternal glory".';

-- ---------------------------------------------------------------------------
-- 2. Discovery. Participants browse challenges on a public page, so a
-- challenge needs to say whether it belongs there.
--
-- `default 'listed'` is chosen so the existing challenge appears on the browse
-- page with no UPDATE required.
-- ---------------------------------------------------------------------------
alter table challenges
  add column if not exists visibility text not null default 'listed',
  add column if not exists created_by uuid references profiles(id);

comment on column challenges.visibility is
  'listed = shown on /challenges; unlisted = reachable only by direct link.';

-- ---------------------------------------------------------------------------
-- 3. Acceptance terms, versioned.
--
-- `terms` is SEPARATE from `rules` on purpose. `rules` is the public rules
-- blurb rendered as a numbered list on the challenge page. `terms` are the
-- acknowledgements a participant ticks to enter ("I understand that..."), one
-- checkbox per line. They were hardcoded in the client
-- (src/app/exam-flame/join-block.tsx), so no challenge could have its own.
--
-- For a cash competition it matters WHICH text someone accepted, so an
-- enrolment records both the version and a hash of the exact text — the version
-- survives an edit, and the hash proves the wording even if the row is later
-- changed.
-- ---------------------------------------------------------------------------
alter table challenges
  add column if not exists terms         text,
  add column if not exists terms_version int not null default 1;

alter table challenge_participants
  add column if not exists terms_version_accepted int,
  add column if not exists terms_hash             text;

comment on column challenge_participants.terms_hash is
  'sha256 of the exact terms text accepted at join time. Proves wording after an edit.';

-- ---------------------------------------------------------------------------
-- 4. Backfill. Idempotent: both statements are no-ops on a second run.
-- ---------------------------------------------------------------------------

-- The three acknowledgements that were hardcoded in join-block.tsx, moved into
-- the row they belong to. Applies to any challenge with no terms set, so a
-- fresh environment seeded from supabase/seed.sql is covered too.
update challenges
set terms = concat_ws(
  E'\n',
  'I understand that submissions require timer-screenshot evidence.',
  'I understand that fraudulent submissions result in disqualification.',
  'I understand that rankings come from verified submissions only.'
)
where terms is null;

-- Everyone who has already joined accepted version 1.
update challenge_participants
set terms_version_accepted = 1
where terms_version_accepted is null;

-- ---------------------------------------------------------------------------
-- 5. Indexes.
--
-- The participant-leading index on challenge_participants is the one that
-- matters: the existing UNIQUE (challenge_id, participant_id) cannot serve a
-- lookup keyed on participant_id, and getMyEnrolments / resolvePrimaryChallenge
-- / the challenge switcher all do exactly that on every render.
-- ---------------------------------------------------------------------------
create index if not exists idx_cp_participant
  on challenge_participants (participant_id, challenge_id);

create index if not exists idx_challenges_status_start
  on challenges (status, start_date desc);

create index if not exists idx_challenges_listed
  on challenges (status, start_date desc)
  where visibility = 'listed';

-- ---------------------------------------------------------------------------
-- 6. get_challenge_index — the browse page and the challenge switcher in one
-- query.
--
-- SECURITY DEFINER because an anonymous visitor cannot read `profiles` (and
-- must not), yet the browse page needs participant counts. It returns COUNTS
-- ONLY — no names, no PII — so there is nothing here an anonymous visitor
-- should not see.
--
-- The viewer is taken from auth.uid() rather than a parameter on purpose: a
-- p_viewer argument on a DEFINER function would let anyone ask "which
-- challenges is this user in?".
--
-- Drafts are hidden from everyone but a super_admin, matching
-- requireChallengeBySlug() in src/lib/challenges.ts. Unlisted challenges are
-- hidden unless an admin explicitly asks for them.
-- ---------------------------------------------------------------------------
create or replace function get_challenge_index(
  p_statuses         text[]  default array['active','verification','completed'],
  p_include_unlisted boolean default false
)
returns table (
  id                  uuid,
  slug                text,
  name                text,
  description         text,
  start_date          date,
  end_date            date,
  duration_days       int,
  status              text,
  visibility          text,
  reward_kind         text,
  prize_note          text,
  prize_structure     jsonb,
  prize_line_position int,
  marks_enabled       boolean,
  participant_count   int,
  viewer_enrolled     boolean
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.slug, c.name, c.description,
    c.start_date, c.end_date, c.duration_days,
    c.status, c.visibility, c.reward_kind, c.prize_note,
    c.prize_structure, c.prize_line_position, c.marks_enabled,
    (select count(*) from challenge_participants cp where cp.challenge_id = c.id)::int,
    exists (
      select 1 from challenge_participants cp2
      where cp2.challenge_id = c.id and cp2.participant_id = (select auth.uid())
    )
  from challenges c
  where c.status = any(p_statuses)
    and (c.status <> 'draft' or (select is_superadmin()))
    and (c.visibility = 'listed' or (p_include_unlisted and (select is_admin())))
  order by c.start_date desc;
$$;

-- Browsing is public, so anon needs this one. Revoke PUBLIC first: anon would
-- otherwise inherit EXECUTE from the default PUBLIC grant whatever we do here.
revoke execute on function public.get_challenge_index(text[], boolean) from public;
grant  execute on function public.get_challenge_index(text[], boolean) to anon;
grant  execute on function public.get_challenge_index(text[], boolean) to authenticated;
grant  execute on function public.get_challenge_index(text[], boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 7. admin_pending_counts — per-challenge review backlog in one query, for the
-- admin queue index and the pending badge.
--
-- plpgsql rather than sql so it can raise: a `language sql` function cannot
-- enforce its own guard, and this one exposes operational counts.
-- ---------------------------------------------------------------------------
create or replace function admin_pending_counts()
returns table (
  challenge_id        uuid,
  slug                text,
  name                text,
  pending_submissions int,
  pending_appeals     int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorised'; end if;

  return query
  select
    c.id, c.slug, c.name,
    (select count(*) from submissions s
      where s.challenge_id = c.id and s.status = 'pending')::int,
    (select count(*) from appeals a
      join submissions s2 on s2.id = a.submission_id
      where s2.challenge_id = c.id and a.status = 'pending')::int
  from challenges c
  where c.status <> 'archived'
  order by c.start_date desc;
end;
$$;

revoke execute on function public.admin_pending_counts() from public;
revoke execute on function public.admin_pending_counts() from anon;
grant  execute on function public.admin_pending_counts() to authenticated;
grant  execute on function public.admin_pending_counts() to service_role;
