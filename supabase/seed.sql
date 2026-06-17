-- Forge — data seed (run AFTER migrations 0001–0004)
-- ----------------------------------------------------------------------------
-- Role bootstrapping is NOT hardcoded here. scripts/seed.ts reads
-- process.env.SUPERADMIN_EMAIL and writes it into app_config; the
-- bootstrap_superadmin_role() trigger (migration 0002) then elevates the
-- matching profile on first sign-in and retains it thereafter.
-- ----------------------------------------------------------------------------

-- Halls (real hall names — §19.10). Edit to match your institution.
insert into halls (name) values
  ('Bello Hall'),
  ('Independence Hall'),
  ('Idia Hall'),
  ('Mellanby Hall'),
  ('Queen Elizabeth II Hall'),
  ('Tafawa Balewa Hall'),
  ('Nnamdi Azikiwe Hall'),
  ('Sultan Bello Hall')
on conflict (name) do nothing;

-- The Exam Flame, seeded as draft (flip to active at launch).
insert into challenges (
  slug, name, description, rules, start_date, end_date,
  prize_structure, prize_line_position, status, timezone
) values (
  'exam-flame',
  'The Exam Flame',
  'Read 8 hours a day for 20 days. 15 winners. ₦105,000 on the line.',
  $rules$1. Submit one entry per day with a timer-screenshot as evidence.
2. Rankings come from verified submissions only.
3. Fraudulent submissions result in disqualification.
4. A submission for a day is accepted up to the end of the following day.
5. We record submission IP for fraud-pattern detection.$rules$,
  '2026-06-17',
  '2026-07-06',
  '[
    { "position": 1, "amount": 20000, "label": "I" },
    { "position": 2, "amount": 15000, "label": "II" },
    { "position": 3, "amount": 10000, "label": "III" },
    { "positions": [4, 15], "amount": 5000, "label": "IV–XV" }
  ]'::jsonb,
  15,
  'draft',
  'Africa/Lagos'
)
on conflict (slug) do nothing;
