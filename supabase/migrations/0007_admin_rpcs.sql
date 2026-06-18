-- Manual hours RPCs (§FIX-5). SECURITY DEFINER so a super_admin can write a
-- confirmed submission on another participant's behalf (RLS would otherwise
-- only allow self-insert of pending rows). Audited like every admin action.

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
begin
  if not is_superadmin() then raise exception 'not authorised'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required'; end if;
  if p_hours <= 0 or p_hours > 24 then raise exception 'hours must be between 0.1 and 24'; end if;

  select duration_days into v_duration from challenges where id = p_challenge_id;
  if v_duration is null then raise exception 'challenge not found'; end if;
  if p_day < 1 or p_day > v_duration then raise exception 'day out of range'; end if;

  if exists (
    select 1 from submissions
    where challenge_id = p_challenge_id and participant_id = p_participant_id and challenge_day = p_day
  ) then
    raise exception 'a submission already exists for that day';
  end if;

  insert into submissions (
    challenge_id, participant_id, challenge_day, hours_claimed, hours_credited,
    topic, status, created_by_admin, created_by_admin_id, screenshot_path, screenshot_phash
  ) values (
    p_challenge_id, p_participant_id, p_day, p_hours, p_hours,
    'Manual entry — ' || p_reason, 'confirmed', true, auth.uid(), null, null
  )
  returning id into v_id;

  perform write_audit(
    'submission.manual_create', 'submission', v_id, null,
    jsonb_build_object('day', p_day, 'hours', p_hours, 'reason', p_reason, 'participant', p_participant_id)
  );
  return v_id;
end;
$$;

create or replace function admin_remove_manual(p_submission_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_prev jsonb;
begin
  if not is_superadmin() then raise exception 'not authorised'; end if;
  select to_jsonb(s.*) into v_prev from submissions s
    where s.id = p_submission_id and s.created_by_admin = true;
  if v_prev is null then raise exception 'not a manual entry'; end if;

  delete from submissions where id = p_submission_id;
  perform write_audit('submission.manual_delete', 'submission', p_submission_id, v_prev, null);
end;
$$;
