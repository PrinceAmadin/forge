-- Manual hours entries by a super_admin (§FIX-5).
-- Mark admin-created submissions and allow them to skip the screenshot, since
-- they're credited from out-of-band evidence (e.g. WhatsApp posts before Forge
-- was live).

alter table submissions add column if not exists created_by_admin boolean not null default false;
alter table submissions add column if not exists created_by_admin_id uuid references profiles(id);

-- Manual entries have no screenshot, so these can't stay NOT NULL.
alter table submissions alter column screenshot_path drop not null;
alter table submissions alter column screenshot_phash drop not null;
