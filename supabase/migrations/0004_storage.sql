-- Forge — storage bucket for screenshot evidence (§11)
-- Private bucket; uploads via short-lived signed URLs, reads via signed URLs.

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- A participant may upload only under their own folder:
--   submissions/{challenge_slug}/{participant_id}/{day}.jpg
-- The participant_id is the 2nd path segment after the bucket.
create policy "submissions_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "submissions_read_own_or_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and ((storage.foldername(name))[2] = auth.uid()::text or is_admin())
  );

create policy "submissions_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Public avatars bucket. Path: avatars/{participant_id}.jpg
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_read_all"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "avatars_write_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
