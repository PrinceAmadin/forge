-- Super-admin account deletion §admin-delete.
--
-- Deleting an auth.users row cascades to profiles (profiles.id references
-- auth.users on delete cascade). For the profile delete to then succeed, every
-- FK that points at profiles must say what happens to dependent rows. Today
-- several are NO ACTION (= RESTRICT), so deleting any user who has submissions
-- (or who ever reviewed/resolved/disqualified) would error. Fix them:
--   * the user's OWN content (submissions, and appeals on those submissions)
--     cascades away with them;
--   * references to the user as an ACTOR (reviewed_by, resolved_by,
--     disqualified_by, audit actor) are nulled so history survives.

-- --- The user's own content: cascade -------------------------------------
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_participant_id_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_participant_id_fkey
  FOREIGN KEY (participant_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Appeals hang off submissions; when a submission cascade-deletes, its appeal
-- must go too (otherwise appeals.submission_id RESTRICT blocks the cascade).
ALTER TABLE appeals DROP CONSTRAINT IF EXISTS appeals_submission_id_fkey;
ALTER TABLE appeals
  ADD CONSTRAINT appeals_submission_id_fkey
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;

-- --- References to the user as an actor: null out, keep the row ------------
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_reviewed_by_fkey;
ALTER TABLE submissions
  ADD CONSTRAINT submissions_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;

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

-- --- Keep the audit trail human-readable after actor_id is nulled ---------
-- audit_log has no metadata column (it uses previous_state / new_state jsonb).
-- Denormalize the actor's identity at write time so a null actor_id still
-- leaves a legible trail.
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
