# Forge — Build Checklist

What's left to turn Forge from a single-challenge app into a platform that can run
many challenges for 1,000–1,500 participants at a time.

**38 items across 5 phases, plus a 9-item launch gate.
5 done, 2 written but not yet applied to the database.**

Legend: `[x]` done and on `main` · `[~]` code written, **database change not applied** ·
`[ ]` not started · **YOURS** = needs you, not me.

> **Two things are not optional and have lead time.** Read the Launch Gate at the
> bottom before planning a date. The custom SMTP item in particular has **no code
> fix** — without it most of 1,500 students cannot sign in on day one.

---

## Phase 0 — Foundation

Makes everything after it verifiable. Nothing here is user-visible.

- [ ] **0.1 Connect the Forge project to the Supabase MCP** — **YOURS**, via `/mcp`.
      Lets me read the live schema instead of inferring it from migration files.
      *Blocks 0.2, and every migration after it is a careful guess until this lands.*
- [ ] **0.2 Migration ledger + reconciliation** — a `schema_migrations` table and a
      script that probes the database to work out which of the 14 migrations are
      actually applied. Right now **nothing records this**.
- [x] **0.3 Quality floor** — working `npm run lint` (it was declared but ESLint was
      never installed), Vitest, GitHub Actions CI. `69aabad`
- [~] **0.4 Integrity hotfixes** — `0013_integrity.sql`: manual-entry RPC requires
      super admin, deterministic leaderboard ranks, `anon` revoked from
      `get_leaderboard`. Plus `createSubmission` no longer trusts a client-supplied
      storage path. `9ce0978` — **migration unapplied**
- [ ] **0.5 Dashboard config** — **YOURS**. Set storage bucket size/MIME limits,
      confirm `pg_cron` is available on your plan, note the live participant count.

---

## Phase 1 — The multi-challenge platform

This is the part you asked for first. **1.10 is the create form.**

- [x] **1.1 Lib foundation** — `src/lib/challenges.ts`: resolve any challenge by
      slug, list them, resolve a user's enrolments, gate a challenge-scoped route.
      Plus lifecycle predicates and reward helpers. `4446b8a`
- [~] **1.2 Platform columns** — `0014_challenge_platform.sql`: `reward_kind`,
      `visibility`, versioned `terms`, three indexes, two index RPCs. `174e4f0` —
      **migration unapplied**
- [ ] **1.3 Constraints + immutability** — date ordering, valid enums, and a trigger
      locking `slug` / `start_date` / `timezone` / prizes once a challenge leaves
      draft. *First migration that can fail against existing rows.*
- [x] **1.4 The route move** — `/c/[slug]/leaderboard|submit|you|readers`, with
      `/exam-flame` and the bare `/leaderboard|/submit|/you` paths redirecting so
      nothing in anyone's bookmarks 404s. Verified against production data.
- [ ] **1.5 Copy de-hardcoding** — challenge name comes from the row everywhere,
      per-challenge OG images (the WhatsApp preview is your acquisition channel),
      and join records which terms version was accepted.
- [x] **1.6 `/challenges` browse page** — public list with dates, prize pool and
      participant count. Built early because the redirect stubs need somewhere to
      send a user who is enrolled in nothing. Still on plain queries, not the
      `get_challenge_index` RPC.
- [ ] **1.7 Challenge switcher** — the header wordmark becomes a switcher for people
      enrolled in several. Renders as plain text when they're in one, so existing
      users see no new UI.
- [ ] **1.8 Per-challenge admin** — the review queue becomes an index of challenges
      with pending work; manual entry takes a challenge; pending badge aggregates.
- [x] **1.9 zod validation module** — shared schemas and one `parseForm` helper,
      with the prize-tier invariants (contiguous, starts at 1, no gaps or
      overlaps) enforced server-side. 35 tests.
- [ ] **1.10 Create form + prize builder** — **the screen you went looking for.**
      Tier builder where contiguity can't be broken, derived cut line, and a
      `reward_kind` switch so a friendly challenge needs no amounts.
- [ ] **1.11 RLS + status transitions** — joins and submissions require a live
      challenge and a real enrolment; `admin_set_challenge_status` enforces the
      lifecycle server-side. *Highest-risk migration — ships last, in four
      separately verified steps.*
- [ ] **1.12 Cleanup** — delete the `/exam-flame` route, the slug constant, the
      orphaned `phash.ts` and unused `sharp`; fix the README (it tells you to run
      4 of 14 migrations), restore the three missing Supabase vars to
      `.env.example`, drop the stray `install.cmd`.

---

## Phase 2 — Correctness

Things that are silently wrong today.

- [ ] **2.1 Hours precision + backfill** — confirmed hours are rounded to 1 decimal,
      so **7h45m is credited as 7.8**. Fixes the function, recomputes every existing
      confirmed row, and makes appeal-restore atomic (it's currently three separate
      writes that can leave a split state).
- [ ] **2.2 Fix Marks** — eligibility becomes rank-based instead of hours-based
      (**this is why it did nothing when you turned it on**: everyone tied, and
      everyone at 0 hours, was blocked), marks visible on mobile, release no longer
      burns the pairing forever, fulfilment matches the board's ranking.
- [ ] **2.3 Marks trigger cost** — a ten-line guard. The trigger currently
      recomputes the whole challenge on every submission change even when marks are
      switched off, which is ~90M wasted row touches a day at full scale.
- [ ] **2.4 Snapshot writer** — **nothing writes `leaderboard_snapshots`**, so the
      entire movement column renders "—" forever. A 6-hourly cron turns it back on.
- [ ] **2.5 One source of truth for the cut** — the "hrs to cross" figure is computed
      twice with different rounding, so the footer and the divider can disagree.

---

## Phase 3 — Scale

What breaks at 1,500 participants.

- [ ] **3.1 Cached, bounded leaderboard** — today every page view runs an uncached
      ~33,000-row aggregate with no limit. Becomes top-50 + a window around your own
      rank, cached per challenge. Also fixes a silent 1,000-row API cap that would
      make ranks 1,001+ vanish.
- [ ] **3.2 Realtime + focus storms** — the refresh debounce has no jitter, so all
      1,500 clients refresh inside the same 50ms window. Adds jitter, deletes two
      subscriptions that cost ~9M profile lookups a day to deliver almost nothing,
      and throttles refresh-on-focus.
- [ ] **3.3 Admin queue survives** — currently unpaginated, mints one signed image
      URL **per row**, and puts up to 1,500 UUIDs in a URL. Breaks at a few hundred
      pending submissions, which is the morning after day one.
- [ ] **3.4 Indexes** — missing on `marks(challenge_id)`, both `appeals` lookups, and
      every foreign key into `profiles`.
- [ ] **3.5 `challenge_standings` table** — denormalised totals maintained by
      statement-level triggers, so leaderboard cost stops growing with the number of
      days. Swaps in behind the same function signatures.

---

## Phase 4 — Security

- [ ] **4.1 Grants / REVOKE** — there is **no `GRANT` or `REVOKE` anywhere** in the
      project, so every `SECURITY DEFINER` function is callable by anyone with the
      public key. Includes `write_audit`, meaning the audit log is forgeable.
      *Riskiest commit in the plan — needs a full role-matrix pass.*
- [ ] **4.2 RLS rewrite** — any signed-in student can currently dump all 1,500
      profiles including phone numbers and suspension reasons, and can clear their
      own `is_suspended`. Also wraps policy helpers so they stop being evaluated
      once per row.
- [ ] **4.3 Storage integrity** — a participant can overwrite a screenshot **after
      an admin confirmed it**, with no fingerprint to compare against. Plus
      server-side size and type limits.
- [ ] **4.4 Rate limiting** — there is none. OTP first: it's called from the browser
      with the public key, so the only brake is a 30-second countdown a page reload
      resets.
- [ ] **4.5 Security headers** — no CSP, HSTS, or frame protection. Ship the cheap
      subset; a full CSP is deliberately deferred.

---

## Phase 5 — Close the loops

- [ ] **5.1 In-app notifications** — nobody is told anything today: not approval,
      rejection, disqualification, being marked, or being overtaken.
- [ ] **5.2 The post-submit moment** — the spec's rank reveal. The fields for it
      already exist in the return type and are never filled; you get a one-line
      banner instead.
- [ ] **5.3 Finish appeals + disqualification** — appeals tab in admin, record who
      resolved them, disqualify from a user's profile (today only reachable if they
      have a pending submission), and a reinstate path.
- [ ] **5.4 Loading + error boundaries** — 22 routes, **zero** `loading.tsx`, one
      root error boundary.
- [ ] **5.5 Events + audit log viewer** — admin actions emit no events, and
      `audit_log` is write-only ("coming soon" in settings).
- [ ] **5.6 Decide `avatar_url`** — collected, uploaded, stored, **rendered
      nowhere**. Either show avatars or remove the whole path.

---

## Launch Gate

Before the next challenge opens to 1,500 people. Not optional at that scale.

- [ ] **Custom SMTP in Supabase Auth** — **YOURS, and the only item with no code
      fix.** Supabase's built-in mailer is throttled per project and explicitly not
      for production. 1,500 students signing in within an hour will not receive
      codes. Alternatives are pre-created accounts with codes distributed
      out-of-band, or adding password auth. **Decide early.**
- [ ] Hours precision fixed **and** backfilled (2.1) — prize money depends on it
- [ ] Deterministic ranks (0.4) applied, tie-inclusive cut (3.1)
- [ ] Cached leaderboard (3.1) + realtime jitter (3.2)
- [ ] Admin queue paginated (3.3) — or nobody can review day one's submissions
- [ ] Grants/REVOKE (4.1) and OTP rate limiting (4.4)
- [ ] Storage overwrite policy narrowed (4.3)
- [ ] Snapshot cron running (2.4) — or the movement column is dishonest
- [ ] Load test at 1,500 seeded participants against a branch database

---

## Shortest path to "I can create a challenge"

If the goal is just to get the create form working and usable:

**1.9 → 1.10** gives you the form. But a challenge it creates stays **invisible**
until **1.4** removes the hardcoded slug — so the honest minimum is
**1.3 → 1.4 → 1.9 → 1.10**, with 1.6 (browse page) right after so people can find
and join it.

`0013` and `0014` should be applied before 1.3, which is what 0.1 unblocks.
