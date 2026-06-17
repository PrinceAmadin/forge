-- Forge — Row Level Security (§8)

alter table profiles               enable row level security;
alter table halls                  enable row level security;
alter table challenges             enable row level security;
alter table challenge_participants enable row level security;
alter table submissions            enable row level security;
alter table appeals                enable row level security;
alter table audit_log              enable row level security;
alter table events                 enable row level security;
alter table leaderboard_snapshots  enable row level security;
alter table app_config             enable row level security;

-- halls: public read; only superadmins write.
create policy halls_read on halls for select using (true);
create policy halls_write on halls for all using (is_superadmin()) with check (is_superadmin());

-- profiles: any authenticated user can read (leaderboard display);
-- only the owner can update; only superadmins can change role.
create policy profiles_read on profiles
  for select using (auth.role() = 'authenticated');
create policy profiles_insert on profiles
  for insert with check (auth.uid() = id);
-- The owner may update their own row. Role escalation is blocked by the
-- bootstrap_superadmin_role() trigger, not here. §9
create policy profiles_update_self on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- Super_admins may update any profile (e.g. role assignment via the app).
create policy profiles_update_admin on profiles
  for update using (is_superadmin()) with check (is_superadmin());

-- challenges: public read; superadmin write.
create policy challenges_read on challenges for select using (true);
create policy challenges_write on challenges
  for all using (is_superadmin()) with check (is_superadmin());

-- challenge_participants: public read; self-insert; admin update.
create policy cp_read on challenge_participants for select using (true);
create policy cp_insert on challenge_participants
  for insert with check (auth.uid() = participant_id);
create policy cp_update_admin on challenge_participants
  for update using (is_admin()) with check (is_admin());

-- submissions: owner/admin read; self-insert as pending; admin update.
create policy submissions_read on submissions
  for select using (auth.uid() = participant_id or is_admin());
create policy submissions_insert on submissions
  for insert with check (auth.uid() = participant_id and status = 'pending');
create policy submissions_update_admin on submissions
  for update using (is_admin()) with check (is_admin());

-- appeals: owner of the underlying submission can read/insert; admin read/update.
create policy appeals_read on appeals
  for select using (
    is_admin() or exists (
      select 1 from submissions s
      where s.id = appeals.submission_id and s.participant_id = auth.uid()
    )
  );
create policy appeals_insert on appeals
  for insert with check (
    exists (
      select 1 from submissions s
      where s.id = appeals.submission_id and s.participant_id = auth.uid()
    )
  );
create policy appeals_update_admin on appeals
  for update using (is_admin()) with check (is_admin());

-- leaderboard_snapshots: public read; admin write.
create policy snapshots_read on leaderboard_snapshots for select using (true);
create policy snapshots_write on leaderboard_snapshots
  for all using (is_admin()) with check (is_admin());

-- events: any authenticated user may insert their own events; admin reads.
create policy events_insert on events
  for insert with check (auth.uid() = user_id or user_id is null);
create policy events_read_admin on events for select using (is_admin());

-- audit_log: no public reads in V1; writes go through SECURITY DEFINER funcs.
create policy audit_read_superadmin on audit_log for select using (is_superadmin());

-- app_config: readable by admins only; writes via service role / superadmin.
create policy app_config_read on app_config for select using (is_admin());
create policy app_config_write on app_config
  for all using (is_superadmin()) with check (is_superadmin());
