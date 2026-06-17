-- Forge — functions & triggers

-- Role helpers (used by RLS). SECURITY DEFINER so they can read profiles
-- without recursive RLS evaluation.
create or replace function current_role_name()
returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin','super_admin') from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function is_superadmin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'super_admin' from profiles where id = auth.uid()),
    false
  );
$$;

-- Two jobs, one BEFORE trigger:
--  1. Elevate the profile whose auth email matches app_config.superadmin_email
--     (idempotent across sign-ins).
--  2. Enforce role immutability: a normal caller can never change their own
--     role via a profile update. Only the service role, an existing
--     super_admin, or the config-email match may set role.
create or replace function bootstrap_superadmin_role()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_superadmin_email text;
  v_user_email       text;
  v_is_config_match  boolean := false;
begin
  select value into v_superadmin_email from app_config where key = 'superadmin_email';
  select email into v_user_email from auth.users where id = new.id;

  if v_superadmin_email is not null and v_superadmin_email <> ''
     and lower(coalesce(v_user_email, '')) = lower(v_superadmin_email) then
    v_is_config_match := true;
    new.role := 'super_admin';
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if not (coalesce(auth.role(), '') = 'service_role' or is_superadmin() or v_is_config_match) then
      new.role := old.role; -- silently preserve; no privilege escalation
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bootstrap_superadmin on profiles;
create trigger trg_bootstrap_superadmin
  before insert or update on profiles
  for each row execute function bootstrap_superadmin_role();

-- The hot path. §8 / §12. Stable so Postgres can cache execution.
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
        earliest_submission asc nulls last
    )::int as rank,
    *
  from active;
$$;
-- DEFINER: aggregates confirmed submissions across all participants. It returns
-- only public leaderboard data, but must bypass the per-row submissions RLS to
-- compute totals for everyone. §12
alter function get_leaderboard(uuid) security definer set search_path = public;

-- Append-only audit writes happen inside the same transaction as state changes.
create or replace function write_audit(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_previous jsonb, p_new jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (actor_id, action, entity_type, entity_id, previous_state, new_state)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_previous, p_new);
$$;

-- Admin: confirm a submission (credits claimed hours) + audit, atomically.
create or replace function admin_review_submission(
  p_submission_id uuid,
  p_decision text,            -- 'confirmed' | 'rejected'
  p_rejection_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb;
  v_credited numeric(4,1);
begin
  if not is_admin() then
    raise exception 'not authorised';
  end if;
  if p_decision not in ('confirmed','rejected') then
    raise exception 'invalid decision %', p_decision;
  end if;

  select to_jsonb(s.*) into v_prev from submissions s where s.id = p_submission_id;
  if v_prev is null then
    raise exception 'submission not found';
  end if;

  v_credited := case when p_decision = 'confirmed'
                     then (v_prev->>'hours_claimed')::numeric else null end;

  update submissions set
    status = p_decision,
    hours_credited = v_credited,
    rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_submission_id;

  perform write_audit(
    'submission.' || p_decision, 'submission', p_submission_id,
    v_prev, (select to_jsonb(s.*) from submissions s where s.id = p_submission_id)
  );
end;
$$;

-- Admin: disqualify a participant from a challenge + audit, atomically.
create or replace function admin_disqualify(
  p_challenge_id uuid, p_participant_id uuid, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prev jsonb; v_id uuid;
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;

  select id, to_jsonb(cp.*) into v_id, v_prev
  from challenge_participants cp
  where cp.challenge_id = p_challenge_id and cp.participant_id = p_participant_id;
  if v_id is null then raise exception 'participant not enrolled'; end if;

  update challenge_participants set
    is_disqualified = true,
    disqualification_reason = p_reason,
    disqualified_at = now(),
    disqualified_by = auth.uid()
  where id = v_id;

  perform write_audit(
    'participant.disqualify', 'challenge_participant', v_id,
    v_prev, (select to_jsonb(cp.*) from challenge_participants cp where cp.id = v_id)
  );
end;
$$;
