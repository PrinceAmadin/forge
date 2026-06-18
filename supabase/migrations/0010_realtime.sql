-- Live updates §realtime — publish the tables whose changes drive the UI so
-- Supabase Realtime streams them to subscribed browsers. Idempotent: each ADD
-- is wrapped so re-running (or a table already being in the publication) is a
-- no-op rather than an error.
--
-- NOTE the real table names: the enrolment table is challenge_participants
-- (not "enrollments"), and submissions key participants via participant_id.

-- The supabase_realtime publication exists by default on Supabase projects;
-- create it defensively in case it was dropped.
DO $$ BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE challenge_participants;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- marks only exists once 0009 has been applied.
DO $$ BEGIN
  IF to_regclass('public.marks') IS NOT NULL THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE marks;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
