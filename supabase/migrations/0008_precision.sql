-- Bump hours columns to 2 decimals so minute-level values store cleanly
-- (e.g. 7h 45m = 7.75; numeric(4,1) would round it to 7.8). §ISSUE-3
-- The <= 24 check constraint and all app logic are unaffected.

alter table submissions alter column hours_claimed       type numeric(5,2);
alter table submissions alter column hours_credited       type numeric(5,2);
alter table submissions alter column ocr_extracted_hours  type numeric(5,2);

-- No materialized leaderboard view to migrate — get_leaderboard() computes live.
