-- Marks — public competitive callouts, per-challenge gated. §Marks
-- (Named 0009: 0008 is the precision migration.)

create table if not exists marks (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id) on delete cascade,
  marker_user_id  uuid not null references profiles(id) on delete cascade,
  target_user_id  uuid not null references profiles(id) on delete cascade,
  status          text not null default 'active'
                  check (status in ('active', 'fulfilled', 'released')),
  created_at      timestamptz not null default now(),
  fulfilled_at    timestamptz,
  released_at     timestamptz,
  unique (challenge_id, marker_user_id, target_user_id)
);

alter table marks add constraint marks_no_self check (marker_user_id != target_user_id);

create index if not exists marks_marker_idx on marks(marker_user_id, challenge_id, status);
create index if not exists marks_target_idx on marks(target_user_id, challenge_id, status);

-- Feature flag. Default off everywhere; super_admin enables per challenge.
alter table challenges add column if not exists marks_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- Confirmed-hours helper (marker/target comparisons use the same basis as the
-- leaderboard: sum of credited hours on confirmed submissions).
-- ---------------------------------------------------------------------------

-- Enforce ABOVE-ONLY at insert: the target must currently have more confirmed
-- hours than the marker (i.e. be ranked above). §rule-1
create or replace function marks_enforce_above()
returns trigger language plpgsql security definer set search_path = public as $$
declare mh numeric; th numeric;
begin
  select coalesce(sum(hours_credited) filter (where status='confirmed'),0) into mh
    from submissions where challenge_id = new.challenge_id and participant_id = new.marker_user_id;
  select coalesce(sum(hours_credited) filter (where status='confirmed'),0) into th
    from submissions where challenge_id = new.challenge_id and participant_id = new.target_user_id;
  if not (th > mh) then
    raise exception 'target is not ranked above you';
  end if;
  return new;
end; $$;

drop trigger if exists marks_enforce_above_before on marks;
create trigger marks_enforce_above_before before insert on marks
  for each row execute function marks_enforce_above();

-- Flip active marks to fulfilled when the marker overtakes the target. §rule-3
create or replace function check_mark_fulfillment(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with hrs as (
    select cp.participant_id,
      coalesce(sum(s.hours_credited) filter (where s.status='confirmed'),0) as h
    from challenge_participants cp
    left join submissions s
      on s.participant_id = cp.participant_id and s.challenge_id = cp.challenge_id
    where cp.challenge_id = p_challenge_id
    group by cp.participant_id
  ),
  upd as (
    update marks mk set status='fulfilled', fulfilled_at = now()
    from hrs hm, hrs ht
    where mk.challenge_id = p_challenge_id
      and mk.status = 'active'
      and hm.participant_id = mk.marker_user_id
      and ht.participant_id = mk.target_user_id
      and hm.h > ht.h
    returning mk.id, mk.marker_user_id, mk.target_user_id
  )
  insert into audit_log (actor_id, action, entity_type, entity_id, new_state)
  select null, 'mark.fulfilled', 'mark', u.id,
         jsonb_build_object('marker', u.marker_user_id, 'target', u.target_user_id)
  from upd u;
end; $$;

-- Re-check after any submission change (confirm/reject/manual/restore/insert).
create or replace function trg_check_marks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform check_mark_fulfillment(coalesce(new.challenge_id, old.challenge_id));
  return null;
end; $$;

drop trigger if exists marks_fulfillment_after on submissions;
create trigger marks_fulfillment_after
  after insert or update or delete on submissions
  for each row execute function trg_check_marks();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table marks enable row level security;

-- Public read only when the challenge has marks enabled.
create policy marks_read on marks for select using (
  exists (select 1 from challenges c where c.id = marks.challenge_id and c.marks_enabled)
);

-- Insert own marks only, when enabled and under the 3 active limit. The
-- above-only rule is enforced by the marks_enforce_above trigger. §rule-2
create policy marks_insert on marks for insert with check (
  marker_user_id = auth.uid()
  and exists (select 1 from challenges c where c.id = challenge_id and c.marks_enabled)
  and (
    select count(*) from marks m2
    where m2.challenge_id = marks.challenge_id
      and m2.marker_user_id = auth.uid()
      and m2.status = 'active'
  ) < 3
);

-- A user may only release their own active marks (no other transitions).
create policy marks_update on marks for update
  using (marker_user_id = auth.uid() and status = 'active')
  with check (marker_user_id = auth.uid() and status = 'released');
