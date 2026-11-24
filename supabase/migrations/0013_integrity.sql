-- Forge — integrity fixes (Phase 0.4)
--
-- Three independent corrections, each the smallest change that closes a real
-- hole. All are `create or replace` / `revoke`, so nothing is dropped and no
-- data moves. Safe to re-run.
--
-- NOTE ON PRODUCTION STATE: this file replaces two function bodies wholesale.
-- The replacements below are the 0002/0007 definitions plus the one-line change
-- described in each section, so applying this brings the database in line with
-- the repository. If production ever diverged from the migration files by hand,
-- that divergence is overwritten here — which is the intent.

-- ---------------------------------------------------------------------------
-- 1. admin_manual_submission: require super_admin, not admin.
--
-- The app has always gated this behind requireSuperAdmin() in
-- src/app/admin/users/actions.ts, but the RPC itself only checked is_admin().
-- Because the function is SECURITY DEFINER and executable over
-- /rest/v1/rpc/..., any plain admin could call it directly with the public anon
-- key and fabricate a 'confirmed' submission — with no screenshot — for any
-- participant on any day, credited straight onto the leaderboard.
-- admin_remove_manual already correctly checked is_superadmin().
--
-- ROLLBACK: re-run with `is_admin()` on the guard line.
-- ---------------------------------------------------------------------------
create or replace function admin_manual_submission(
  p_challenge_id   uuid,
  p_participant_id uuid,
  p_day            int,
  p_hours          numeric,
  p_reason         text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_duration int;
  v_ceiling  numeric(4,1);
  v_hours    numeric(5,2);
begin
  if not is_superadmin() then raise exception 'not authorised'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  if p_hours <= 0 then raise exception 'hours must be greater than 0'; end if;

  select duration_days, daily_hour_ceiling into v_duration, v_ceiling
  from challenges where id = p_challenge_id;
  if v_duration is null then raise exception 'challenge not found'; end if;
  if p_day < 1 or p_day > v_duration then raise exception 'day out of range'; end if;

  -- TODO(Phase 1.8): also require an enrolment row. get_leaderboard starts
  -- `from challenge_participants`, so a manual entry for a participant who
  -- never joined is silently invisible on the board. Left out here to keep this
  -- migration to one behavioural change per function.

  -- Clamp to the challenge's daily ceiling.
  v_hours := least(p_hours, v_ceiling);

  if exists (
    select 1 from submissions
    where challenge_id = p_challenge_id and participant_id = p_participant_id and challenge_day = p_day
  ) then
    raise exception 'a submission already exists for that day';
  end if;

  insert into submissions (
    challenge_id, participant_id, challenge_day, hours_claimed, hours_credited,
    topic, status, created_by_admin, created_by_admin_id,
    screenshot_path, screenshot_phash, reviewed_by, reviewed_at
  ) values (
    p_challenge_id, p_participant_id, p_day, v_hours, v_hours,
    'Manual entry — ' || p_reason, 'confirmed', true, auth.uid(),
    null, null, auth.uid(), now()
  )
  returning id into v_id;

  perform write_audit(
    'submission.manual_create', 'submission', v_id, null,
    jsonb_build_object('day', p_day, 'hours', v_hours, 'reason', p_reason, 'participant', p_participant_id)
  );
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. get_leaderboard: make the ranking deterministic.
--
-- The ordering ended at `earliest_submission asc nulls last`, with no final
-- tiebreaker. Every participant who has not yet had a submission confirmed sits
-- at total_hours = 0, verified_days = 0, earliest_submission = NULL — fully
-- tied — so Postgres was free to order them differently on each execution. With
-- the leaderboard re-rendering on focus and on realtime events, those readers
-- watched their rank jump between refreshes for no reason.
--
-- Adding participant_id as the last term makes the sort total, so repeated
-- executions return identical ranks. It is an arbitrary but stable tiebreak;
-- Phase 3.1 additionally exposes rank() so genuine ties can SHARE a number and
-- the prize-line cut becomes tie-inclusive.
--
-- ROLLBACK: re-run without the `participant_id asc` line.
-- ---------------------------------------------------------------------------
create or replace function get_leaderboard(p_challenge_id uuid)
returns table (
  rank                int,
  participant_id      uuid,
  full_name           text,
  course              text,
  hall_name           text,
  verified_days       int,
  total_hours         numeric,
  earliest_submission timestamptz,
  last_submission     timestamptz,
  is_disqualified     boolean
)
language sql stable as $$
  with active as (
    select
      cp.participant_id,
      p.full_name,
      p.course,
      h.name as hall_name,
      count(s.id) filter (where s.status = 'confirmed') as verified_days,
      coalesce(sum(s.hours_credited) filter (where s.status = 'confirmed'), 0) as total_hours,
      min(s.submitted_at) filter (where s.status = 'confirmed') as earliest_submission,
      max(s.submitted_at) filter (where s.status = 'confirmed') as last_submission,
      cp.is_disqualified
    from challenge_participants cp
    join profiles p on p.id = cp.participant_id
    left join halls h on h.id = p.hall_id
    left join submissions s
      on s.participant_id = cp.participant_id
      and s.challenge_id = cp.challenge_id
    where cp.challenge_id = p_challenge_id
    group by cp.participant_id, p.full_name, p.course, h.name, cp.is_disqualified
  )
  select
    row_number() over (
      order by
        is_disqualified asc,
        total_hours desc,
        verified_days desc,
        earliest_submission asc nulls last,
        participant_id asc
    )::int as rank,
    *
  from active;
$$;
-- DEFINER: aggregates confirmed submissions across all participants. It returns
-- only public leaderboard data, but must bypass the per-row submissions RLS to
-- compute totals for everyone. §12
alter function get_leaderboard(uuid) security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- 3. Stop anon from executing get_leaderboard.
--
-- Postgres grants EXECUTE on new functions to PUBLIC, and nothing in this
-- project has ever revoked it. Combined with SECURITY DEFINER (which bypasses
-- the submissions RLS by design) that made
-- `POST /rest/v1/rpc/get_leaderboard` an unauthenticated endpoint returning
-- every participant's name, course, hall and hours for ANY challenge id,
-- including drafts — and, because each call aggregates the whole challenge, a
-- one-request denial-of-service lever.
--
-- Revoking from `anon` alone is not enough: anon inherits the PUBLIC grant. So
-- revoke PUBLIC and grant back explicitly.
--
-- Who still needs it:
--   authenticated — the board itself. /leaderboard is behind middleware auth,
--                   so every real board read is an authenticated request.
--   service_role  — src/app/opengraph-image.tsx uses the service-role key.
--
-- Known consequence: if SUPABASE_SERVICE_ROLE_KEY is absent in some
-- environment, opengraph-image.tsx falls back to the anon key and its podium
-- query will now fail — it already catches that and renders its SVG fallback.
-- Phase 3.1 moves that route onto the cached reader and removes the fallback.
--
-- ROLLBACK: grant execute on function public.get_leaderboard(uuid) to public;
-- ---------------------------------------------------------------------------
revoke execute on function public.get_leaderboard(uuid) from public;
revoke execute on function public.get_leaderboard(uuid) from anon;
grant  execute on function public.get_leaderboard(uuid) to authenticated;
grant  execute on function public.get_leaderboard(uuid) to service_role;
