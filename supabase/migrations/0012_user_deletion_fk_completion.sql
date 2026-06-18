-- Account deletion FK completion §admin-delete.
--
-- 0011 fixed most FKs into profiles, but missed two that also default to
-- NO ACTION (= RESTRICT) and silently block deletion:
--   * events.user_id              — analytics rows for the user
--   * submissions.created_by_admin_id — the admin who keyed a manual entry
--
-- This migration is self-contained and idempotent (DROP IF EXISTS + ADD): run
-- it on its own and every FK that points at profiles ends up in the correct
-- state, regardless of whether 0011 was applied. Safe to re-run.

-- === The deleted user's OWN content: cascade =============================
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_participant_id_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_submission_id_fkey;
ALTER TABLE appeals
  ADD CONSTRAINT appeals_submission_id_fkey
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;

-- === References to the user as an ACTOR: null out, keep the row ==========
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_reviewed_by_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- NEW: the admin who created a manual entry (0006). Without this, deleting an
-- admin who ever keyed manual hours errors.
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_created_by_admin_id_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_created_by_admin_id_fkey
  FOREIGN KEY (created_by_admin_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_resolved_by_fkey;
ALTER TABLE appeals
  ADD CONSTRAINT appeals_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE challenge_participants DROP CONSTRAINT IF EXISTS challenge_participants_disqualified_by_fkey;
ALTER TABLE challenge_participants
  ADD CONSTRAINT challenge_participants_disqualified_by_fkey
  FOREIGN KEY (disqualified_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- NEW: analytics events for the deleted user — anonymize rather than block.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_user_id_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- === Audit denormalization (re-assert from 0011; idempotent) =============
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_name text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_email text;

create or replace function write_audit(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_previous jsonb, p_new jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (
    actor_id, actor_name, actor_email,
    action, entity_type, entity_id, previous_state, new_state
  )
  values (
    auth.uid(),
    (select full_name from profiles where id = auth.uid()),
    (select email from auth.users where id = auth.uid()),
    p_action, p_entity_type, p_entity_id, p_previous, p_new
  );
$$;
