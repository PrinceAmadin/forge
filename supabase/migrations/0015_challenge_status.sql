-- Forge — challenge lifecycle transitions (Phase 1.11, part A)
--
-- Additive: two new functions and their grants. No table is altered, no policy
-- is changed, no data moves. Safe to re-run.
--
-- Requires 0014 (reward_kind). Apply 0013, 0014, then this.
--
-- Part B of 1.11 — tightening cp_insert, submissions_insert and
-- challenges_read — is deliberately NOT here. Those alter the live write path
-- and depend on facts about existing rows that the pre-flight queries answer
-- (any challenge still in 'draft', any submission with no enrolment row).
-- Shipping the safe half now means a draft challenge can be launched from the
-- admin UI without waiting on that.

-- ---------------------------------------------------------------------------
-- 1. challenge_is_joinable — one definition of "open for entries", so the
-- RLS policy in part B, the server actions and the UI cannot drift apart.
--
-- A draft is visible to a super_admin for preview but is never joinable by
-- anyone else; this returns true for a super_admin so they can test the join
-- flow before launch.
-- ---------------------------------------------------------------------------
create or replace function challenge_is_joinable(p_challenge_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status = 'active' or (status = 'draft' and is_superadmin())
     from challenges where id = p_challenge_id),
    false);
$$;

revoke execute on function public.challenge_is_joinable(uuid) from public;
revoke execute on function public.challenge_is_joinable(uuid) from anon;
grant  execute on function public.challenge_is_joinable(uuid) to authenticated;
grant  execute on function public.challenge_is_joinable(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. admin_set_challenge_status — the only way a challenge changes status.
--
-- The README previously told you to run
--   update challenges set status = 'active' where slug = 'exam-flame';
-- by hand. That worked but enforced nothing and left no trace, which is why
-- `challenge.status_transition` is in the spec's §16 list of audited actions
-- and has never once been emitted.
--
-- This function is the authority on the transition graph. lib/challenge.ts
-- mirrors it so the admin UI only offers moves that will be accepted, but the
-- check here is what actually holds — the RPC is reachable directly.
--
-- The graph is forward-only with ONE back-edge, verification → active, to
-- reopen a challenge whose day was closed in error. Archived is terminal.
--
-- ROLLBACK: drop function admin_set_challenge_status(uuid, text);
-- ---------------------------------------------------------------------------
create or replace function admin_set_challenge_status(
  p_challenge_id uuid,
  p_next         text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev        text;
  v_reward      text;
  v_tiers       jsonb;
  v_cut         int;
  v_slug        text;
  v_bad_tiers   int;
begin
  if not is_superadmin() then raise exception 'not authorised'; end if;

  -- FOR UPDATE: two admins clicking at once must not both pass the graph check.
  select status, coalesce(reward_kind, 'cash'), prize_structure, prize_line_position, slug
    into v_prev, v_reward, v_tiers, v_cut, v_slug
    from challenges where id = p_challenge_id
    for update;

  if v_prev is null then raise exception 'challenge not found'; end if;
  if v_prev = p_next then return; end if;  -- idempotent, not an error

  if not (
       (v_prev = 'draft'        and p_next = 'active')
    or (v_prev = 'active'       and p_next = 'verification')
    or (v_prev = 'verification' and p_next in ('completed', 'active'))
    or (v_prev = 'completed'    and p_next = 'archived')
  ) then
    raise exception 'illegal transition: % -> %', v_prev, p_next;
  end if;

  -- Launch readiness. A half-configured challenge going live is the one
  -- mistake here that participants would see, so it is checked rather than
  -- trusted to the form. Mirrors launchBlocker() in lib/challenge.ts.
  if p_next = 'active' and v_prev = 'draft' then
    if v_cut is null or v_cut < 1 then
      raise exception 'set the cut before launching';
    end if;

    -- Only a cash challenge must have prizes. A friendly one launches with
    -- none, which is the whole point of reward_kind — without this branch a
    -- friendly challenge could never leave draft.
    if v_reward = 'cash' then
      if coalesce(jsonb_array_length(v_tiers), 0) = 0 then
        raise exception 'a cash challenge needs at least one prize tier';
      end if;
      select count(*) into v_bad_tiers
        from jsonb_array_elements(v_tiers) t
        where t->>'amount' is null;
      if v_bad_tiers > 0 then
        raise exception 'every tier of a cash challenge needs an amount';
      end if;
    end if;
  end if;

  update challenges set status = p_next where id = p_challenge_id;

  perform write_audit(
    'challenge.status_transition', 'challenge', p_challenge_id,
    jsonb_build_object('status', v_prev),
    jsonb_build_object('status', p_next, 'slug', v_slug)
  );
end;
$$;

revoke execute on function public.admin_set_challenge_status(uuid, text) from public;
revoke execute on function public.admin_set_challenge_status(uuid, text) from anon;
grant  execute on function public.admin_set_challenge_status(uuid, text) to authenticated;
grant  execute on function public.admin_set_challenge_status(uuid, text) to service_role;
