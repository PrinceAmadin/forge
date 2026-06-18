-- One-time elevation of the configured superadmin (§11).
--
-- The automatic path already exists: bootstrap_superadmin_role() (migration
-- 0002) fires BEFORE INSERT/UPDATE on profiles and sets role = 'super_admin'
-- when the row's auth email matches app_config.superadmin_email. This migration
-- is the explicit backfill for a user who completed their profile *before*
-- app_config was populated (so the trigger had nothing to match at insert time).
--
-- NOTE: profiles has no `email` column — email lives in auth.users — so we join
-- through it rather than `WHERE profiles.email = ...`. Idempotent: re-running
-- only re-confirms 'super_admin'.

update profiles p
set role = 'super_admin'
from auth.users u
where p.id = u.id
  and lower(u.email) = (
    select lower(value) from app_config where key = 'superadmin_email'
  )
  and p.role <> 'super_admin';
