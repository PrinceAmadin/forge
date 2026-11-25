-- Forge — make Marks actually work (Phase 2.2)
--
-- Marks was switched on during a live challenge and did nothing. Four separate
-- defects, all fixed here. Requires 0009.
--
-- Safe to re-run. The one structural change is swapping a unique constraint for
-- a partial unique index; it drops no data and is reversible (the original
-- statement is in the comment below it).

-- ---------------------------------------------------------------------------
-- 1. "Above you" means RANKED above you, not holding more hours.
--
-- The old guard was `target_hours > marker_hours`, which is why nobody could
-- place a mark:
--   * at the start of a challenge everyone has 0 confirmed hours, so the test
--     is 0 > 0 — false for the entire field;
--   * in an "8 hours a day" challenge totals cluster on round numbers, so ties
--     are the norm rather than the exception;
--   * the board breaks ties on verified_days then earliest_submission, so a
--     reader genuinely ranked above you was unmarkable whenever hours matched.
--
-- "Ranked above" is a pairwise comparison, so there is no need to rank the
-- whole field: build each side's ordering tuple and compare them under exactly
-- the ORDER BY that get_leaderboard uses.
--
--   is_disqualified asc        -> boolean asc (false sorts first)
--   total_hours desc           -> negate
--   verified_days desc         -> negate
--   earliest_submission asc    -> nulls last, emulated with 'infinity'
--
-- Two aggregates instead of a full ranking, and it agrees with the board by
-- construction. markEligibility() in src/lib/mark-eligibility.ts compares
-- rank, which is the same ordering.
-- ---------------------------------------------------------------------------
create or replace function marks_standing(p_challenge_id uuid, p_participant_id uuid)
returns table (
  dq        boolean,
  neg_hours numeric,
  neg_days  bigint,
  earliest  timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(cp.is_disqualified, false)                                            as dq,
    -coalesce(sum(s.hours_credited) filter (where s.status = 'confirmed'), 0)       as neg_hours,
    -count(s.id) filter (where s.status = 'confirmed')                              as neg_days,
    coalesce(min(s.submitted_at) filter (where s.status = 'confirmed'),
             'infinity'::timestamptz)                                              as earliest
  from challenge_participants cp
  left join submissions s
    on s.participant_id = cp.participant_id and s.challenge_id = cp.challenge_id
  where cp.challenge_id = p_challenge_id and cp.participant_id = p_participant_id
  group by cp.is_disqualified;
$$;

revoke execute on function public.marks_standing(uuid, uuid) from public;
revoke execute on function public.marks_standing(uuid, uuid) from anon;
grant  execute on function public.marks_standing(uuid, uuid) to authenticated;
grant  execute on function public.marks_standing(uuid, uuid) to service_role;

create or replace function marks_enforce_above()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m_dq boolean; m_h numeric; m_d bigint; m_e timestamptz;
  t_dq boolean; t_h numeric; t_d bigint; t_e timestamptz;
begin
  select s.dq, s.neg_hours, s.neg_days, s.earliest into m_dq, m_h, m_d, m_e
    from marks_standing(new.challenge_id, new.marker_user_id) s;
  select s.dq, s.neg_hours, s.neg_days, s.earliest into t_dq, t_h, t_d, t_e
    from marks_standing(new.challenge_id, new.target_user_id) s;

  -- Either side missing means they are not enrolled in this challenge.
  if m_dq is null then raise exception 'you are not in this challenge'; end if;
  if t_dq is null then raise exception 'that reader is not in this challenge'; end if;
  if t_dq then raise exception 'that reader is out of the running'; end if;

  -- Sorts strictly earlier under the board's ordering = ranked above.
  if not ((t_dq, t_h, t_d, t_e) < (m_dq, m_h, m_d, m_e)) then
    raise exception 'target is not ranked above you';
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------------------------
-- 2. Releasing a mark no longer burns the pairing forever.
--
-- The unique constraint ignored status, so once a mark was released the author
-- could never mark that reader again — createMark returned "You've already
-- marked this reader this challenge", which reads like a bug because it is one.
-- Scoping uniqueness to active marks keeps the real rule (one live mark per
-- pair) while letting a released or fulfilled one sit in history.
--
-- ROLLBACK:
--   drop index if exists marks_one_active_per_pair;
--   alter table marks add constraint marks_challenge_id_marker_user_id_target_user_id_key
--     unique (challenge_id, marker_user_id, target_user_id);
-- ---------------------------------------------------------------------------
-- Found by its columns rather than by name. The inline UNIQUE in 0009 got an
-- auto-generated name, and `drop constraint if exists <guessed name>` would
-- silently do nothing if it differed — leaving the old constraint in place and
-- this fix quietly ineffective. Raising instead of guessing.
do $$
declare v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  where c.conrelid = 'public.marks'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(c.conkey) k
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
    ) = array['challenge_id','marker_user_id','target_user_id']
  limit 1;

  if v_name is not null then
    execute format('alter table marks drop constraint %I', v_name);
    raise notice 'dropped unconditional unique constraint %', v_name;
  else
    raise notice 'no unconditional unique constraint found (already migrated)';
  end if;
end $$;

create unique index if not exists marks_one_active_per_pair
  on marks (challenge_id, marker_user_id, target_user_id)
  where status = 'active';

-- Self-check: exactly one active mark per pair must still be enforced, and the
-- unconditional version must be gone. Fails the migration if either is wrong.
do $$
begin
  if exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.marks'::regclass and c.contype = 'u'
      and (
        select array_agg(a.attname::text order by a.attname)
        from unnest(c.conkey) k
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
      ) = array['challenge_id','marker_user_id','target_user_id']
  ) then
    raise exception 'the unconditional unique constraint on marks is still present';
  end if;

  if not exists (
    select 1 from pg_indexes
    where tablename = 'marks' and indexname = 'marks_one_active_per_pair'
  ) then
    raise exception 'marks_one_active_per_pair was not created';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Fulfilment uses the board's rule, and can be undone.
--
-- It compared hours only (`hm.h > ht.h`) while the board ranks on four terms,
-- so a mark could read "fulfilled" while the marker was still below the target.
-- And it was one-way: if the submission that caused the overtake was later
-- rejected, the mark stayed fulfilled and the badge kept claiming an overtake
-- that had been reversed.
--
-- Now it recomputes both directions from the same ordering tuple, so the state
-- always reflects the current board.
-- ---------------------------------------------------------------------------
create or replace function check_mark_fulfillment(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Nothing to do when the feature is off for this challenge.
  if not exists (select 1 from challenges c
                 where c.id = p_challenge_id and c.marks_enabled) then
    return;
  end if;

  with standing as (
    select
      cp.participant_id,
      coalesce(cp.is_disqualified, false) as dq,
      -coalesce(sum(s.hours_credited) filter (where s.status = 'confirmed'), 0) as neg_hours,
      -count(s.id) filter (where s.status = 'confirmed') as neg_days,
      coalesce(min(s.submitted_at) filter (where s.status = 'confirmed'),
               'infinity'::timestamptz) as earliest
    from challenge_participants cp
    left join submissions s
      on s.participant_id = cp.participant_id and s.challenge_id = cp.challenge_id
    where cp.challenge_id = p_challenge_id
    group by cp.participant_id, cp.is_disqualified
  ),
  -- Has the marker overtaken the target, by the board's ordering?
  pairs as (
    select mk.id, mk.status, mk.marker_user_id, mk.target_user_id,
           ((hm.dq, hm.neg_hours, hm.neg_days, hm.earliest)
            < (ht.dq, ht.neg_hours, ht.neg_days, ht.earliest)) as overtaken
    from marks mk
    join standing hm on hm.participant_id = mk.marker_user_id
    join standing ht on ht.participant_id = mk.target_user_id
    where mk.challenge_id = p_challenge_id
      and mk.status in ('active', 'fulfilled')
  ),
  newly_fulfilled as (
    update marks mk set status = 'fulfilled', fulfilled_at = now()
    from pairs p
    where mk.id = p.id and p.status = 'active' and p.overtaken
    returning mk.id, mk.marker_user_id, mk.target_user_id
  ),
  -- Reversed: the overtake no longer holds, so the mark goes back to active.
  reverted as (
    update marks mk set status = 'active', fulfilled_at = null
    from pairs p
    where mk.id = p.id and p.status = 'fulfilled' and not p.overtaken
    returning mk.id
  )
  insert into audit_log (actor_id, action, entity_type, entity_id, new_state)
  select null, 'mark.fulfilled', 'mark', n.id,
         jsonb_build_object('marker', n.marker_user_id, 'target', n.target_user_id)
  from newly_fulfilled n;
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Stop the trigger doing a full-challenge recompute on every row change.
--
-- It fired FOR EACH ROW on every insert, update and delete of a submission —
-- including an edit to internal_notes, which cannot affect anyone's hours — and
-- recomputed the whole challenge each time, whether or not marks were even
-- enabled. At 1,500 participants that is on the order of 90M row touches a day
-- of pure waste, lengthening every admin confirm.
--
-- The WHEN clause skips changes that cannot move the board, and
-- check_mark_fulfillment now returns immediately when marks are off.
-- ---------------------------------------------------------------------------
drop trigger if exists marks_fulfillment_after on submissions;
create trigger marks_fulfillment_after
  after insert or update or delete on submissions
  for each row
  when (
    tg_op <> 'UPDATE'
    or old.status         is distinct from new.status
    or old.hours_credited is distinct from new.hours_credited
  )
  execute function trg_check_marks();

-- ---------------------------------------------------------------------------
-- 5. The index src/lib/marks.ts needs. getLeaderboardMarks filters on
-- challenge_id alone, and both existing indexes lead with a user id, so that
-- query was a sequential scan on the hot path whenever marks were enabled.
-- ---------------------------------------------------------------------------
create index if not exists marks_challenge_idx on marks (challenge_id, status);
