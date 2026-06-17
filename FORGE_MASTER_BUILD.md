# Forge — Master Build Prompt

## 0. Read This Block First — Your Role

You are not being asked to "build a leaderboard app."

You are the founding design team, product manager, UX lead, frontend architect, backend architect, and implementation engineer for Forge. Treat every decision in this document as your decision, defended by you, not as a list of tasks to be ticked off. If a section reads like a constraint, it is. If a section reads like guidance, it is also a constraint — phrased softly because the right judgment depends on the moment.

When you encounter a choice between two implementations, the rule is:

> If a decision must be made between (a) easier implementation, (b) better user experience — choose better user experience. Always.

You are not optimizing for speed of implementation. You are optimizing for product quality, perceived speed of the running app, and the feeling that this product was handcrafted by people who care.

The final result must not feel templated. Not generated. Not derived from a typical SaaS starter kit. The forbidden tells of AI-generated code (described in §7) must never appear.

---

## 1. Product Vision

Forge is a competitive accountability platform.

Forge is **not** a habit tracker. It is **not** a reading tracker. It is **not** a study app. It is **not** a productivity dashboard. Those framings would produce the wrong product. You must reject them throughout the build.

Forge is the platform on which **challenges** are run. The first challenge it hosts is called **The Exam Flame** — a 20-day reading competition where participants commit to 8 hours of reading per day, evidence is gathered daily, and 15 winners share ₦105,000. Future challenges already imagined include ReadHabit, CodeHabit, and Clash of Halls. Forge must be architected such that adding a new challenge later requires creating a row in a database table, not rewriting the application.

The product is about creating tension, rivalry, public accountability, and the pursuit of excellence in measurable categories. Users should feel like they are participating in a season, a campaign, a championship. They should never feel like they are filling out a study log.

The leaderboard is the product. Every other surface — submission, profile, admin queue — exists to serve the leaderboard's integrity.

---

## 2. Product Psychology

This section is more important than the feature list. Reread it before every meaningful design decision.

Users open Forge to answer five questions, in roughly this order of frequency:

1. **Am I winning?**
2. **Who passed me since I last checked?**
3. **How far am I from the prize line?**
4. **Who am I chasing?**
5. **Who is chasing me?**

They do **not** open Forge to answer "how many hours have I logged?" — that's the *means*; the rank is the *end*.

This single insight changes every screen.

- The personal dashboard does not lead with total hours. It leads with **rank** and **distance from the prize line**. Total hours are secondary.
- The leaderboard shows **deltas** (movement since last update) as prominently as the ranking itself. A leaderboard without movement is a list. A leaderboard with movement is a story.
- The submission form does not end with "submission received." It ends with **"You moved up two places"** or **"You are now 4.5 hours from the prize line."** Every action returns the user to ranking context.
- Empty states do not say "no submissions yet." They say **"No blood drawn yet. Be the first."** — the language of competition, not utility.

If you ever find yourself building a screen that does not answer one of the five questions above, you are building the wrong screen.

---

## 3. Mobile-First Philosophy

**Approximately 95% of Forge users will arrive on mobile devices.** This is not a guess and it is not negotiable. Almost every participant joins through a WhatsApp group link on their phone. Almost every submission is uploaded from a phone camera roll. Almost every leaderboard check happens on a phone between classes.

Mobile is therefore the primary canvas. Desktop is an adaptation of the mobile design — not the other way around.

**The viewport sizes you design for, in order:**

1. 390px (iPhone 13/14/15 base — your reference width)
2. 414px (iPhone 14 Plus / older iPhones)
3. 360px (common Android — must not break)
4. 430px (iPhone 14/15 Pro Max)
5. Tablet (768px) — adapts cleanly
6. Desktop (≥1024px) — final adaptation; constrain content to a 720–880px reading column for narrative screens, full-bleed for the leaderboard table

**Mobile design constraints, non-negotiable:**

- All interactive targets are at least 44px × 44px (Apple's HIG minimum). No exceptions.
- All thumb-zone interactions live in the lower 60% of the screen. Confirm/Submit/Approve buttons sit at the bottom edge with safe-area padding.
- No hover states. Use pressed states (`active:` in Tailwind) and visible focus rings.
- All scroll containers use native momentum scrolling. No custom scroll-jacking, no parallax.
- Inputs must use the correct `inputmode` and `type` so the right mobile keyboard opens (`inputmode="numeric"` for hours, `type="email"` for email, `type="tel"` for phone).
- The viewport meta tag must include `viewport-fit=cover` and `interactive-widget=resizes-content` so the keyboard does not break layouts.
- The app must respect iOS safe-area insets (notch, home indicator) using `env(safe-area-inset-*)`.
- Image uploads must use `<input type="file" accept="image/*" capture="environment">` so the camera can open directly, but also accept gallery picks.

**The mobile navigation model:**

For the participant role, use a **bottom tab bar** with exactly three tabs:

1. **Leaderboard** — the public standings (default tab on first load after auth)
2. **Submit** — the daily entry form (center, slightly emphasized)
3. **You** — personal dashboard + profile

The tab bar is fixed at the bottom, 64px tall + safe-area-inset-bottom, with a 1px top border in zinc-800 and the page background. Active tab uses amber accent on the icon and label; inactive tabs use zinc-500. Icons are small (20px), labels are 10px Geist Sans below the icon.

Admins do **not** see the participant tab bar. Admins land on a dedicated single-purpose review queue (described in §16). No tabs, no distractions — just the next submission to review.

For desktop adaptation, the bottom tabs become a slim left sidebar (200px wide) with the same three destinations, but the leaderboard itself remains full-bleed.

---

## 4. Tech Stack — Definitive

Every choice here is made deliberately. Do not substitute.

**Frontend**

- **Next.js 15** with the App Router. Server Components by default; Client Components only where interactivity demands it.
- **React 19**.
- **TypeScript**, strict mode (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- **Tailwind CSS v4**, configured with a custom design token layer (see §5).
- **Fonts loaded via `next/font/google`** — Instrument Serif, Geist Sans, Geist Mono. No external `<link>` tags; `next/font` self-hosts and eliminates layout shift.

**Backend / Data Layer**

- **Supabase** for Postgres, Auth, and Storage. Single platform, single client library, no glue code.
- **`@supabase/supabase-js`** as the data client. **Do not use Prisma.** Prisma on Vercel serverless with a remote Postgres adds cold-start tax, connection pool churn, and a code-generation step Forge does not need. This is the single biggest reason the prior platform (Traqly) degraded over time. Talking to Supabase directly is faster, simpler, and avoids the schema-drift class of bugs.
- **Server Actions** for mutations. **Route Handlers** for anything that must be a true API (webhooks, OG image generation, etc.).
- **No ORM.** Write SQL where SQL is clearer; use the Supabase JS client's query builder elsewhere.

**Authentication**

- **Supabase Auth with Email OTP (one-time passcode)** as the V1 mechanism.
- Google OAuth is deferred to Phase 2. Setting up Google OAuth requires a Google Cloud project, OAuth consent screen configuration, domain verification, and potentially a manual review — none of which is appropriate for an overnight launch. ChatGPT's recommendation of Google-as-primary is wrong for V1 and is hereby overruled. Email OTP via Supabase ships in under an hour and works for every user with an email address.
- No passwords. Ever. There is no password creation flow, no reset flow, no security questions.

**Storage**

- **Supabase Storage** for screenshot uploads.
- **Uploads go directly from the browser to Supabase Storage using signed URLs.** Do not proxy uploads through a Next.js Route Handler — that doubles latency, burns serverless function time, and creates a 4.5MB request-body limit on Vercel. The flow is: client requests a signed URL from a Server Action, client `PUT`s the file directly to Storage, client sends the resulting `storage_path` to the submission insert.

**Image processing**

- **`sharp`** on the server for perceptual hash computation (duplicate-screenshot detection). Computed once at upload time, stored on the submission row.
- **`tesseract.js`** in the browser for OCR of the stopwatch screenshot. Extracts the timer value to compare against the claimed hours. Phase 1.5 — ship without it if needed.

**Hosting**

- **Vercel** for the Next.js app. Edge runtime for read-only routes (leaderboard, public challenge page); Node runtime for routes that need `sharp` or other Node libraries.
- **Supabase Cloud** for the database. Pick the region closest to Lagos (likely `eu-west` or `eu-central`).

**Analytics**

- **Vercel Analytics** + **Vercel Speed Insights** for free Core Web Vitals.
- **Custom event logging** to a Supabase `events` table for product analytics that matter (submission, approval, rejection, challenge join, leaderboard view). Avoid third-party analytics — every script tag is a performance tax.

**What is explicitly excluded:**

- ❌ Prisma (cold-start tax, schema-gen complexity)
- ❌ NextAuth (Supabase Auth is sufficient; NextAuth's session lookups are themselves a performance hit when not configured carefully)
- ❌ Cloudinary, UploadThing, S3 wrappers — Supabase Storage is sufficient
- ❌ tRPC — Server Actions and Route Handlers cover every need
- ❌ Zustand / Redux / Jotai — Server Components + URL search params + React's `useState` are sufficient
- ❌ React Query / SWR — Next.js's built-in caching with `revalidate` and `revalidatePath` is the right tool for this app's data shape
- ❌ Drizzle (a valid alternative to Prisma, but we don't need the abstraction for a single-database product)
- ❌ Any UI library that ships in a "starter template" — shadcn/ui is acceptable for primitive form controls (input, button, label) but **not** for cards, dashboards, or anything that imposes a visual idiom
- ❌ Framer Motion (animations are deliberate and few; CSS handles them)

---

## 5. Design System

The design system is the strongest opinion in this product. Departures from it must be deliberate, justified, and rare.

### 5.1 Color palette — exact hex values

There are **seven colors total** in Forge. Anything not on this list does not appear in the UI.

| Token | Hex | Purpose |
|---|---|---|
| `bg` | `#0A0A0B` | Page background. Near-black, slightly warm. Not pure black. |
| `text-primary` | `#FAFAFA` | Primary text, hero numbers, top-3 rank numerals' container |
| `text-secondary` | `#A1A1AA` | Secondary text (hall names, body in dimmed rows) |
| `text-tertiary` | `#71717A` | Metadata, labels, tertiary text |
| `text-quaternary` | `#52525B` | Disqualified rank numerals, very dim text |
| `border` | `#27272A` | Row separators, dividers |
| `border-dim` | `#18181B` | Separators inside the dimmed (below-cut) section |
| `accent` | `#F59E0B` | The amber. Used sparingly — see budget below. |
| `accent-tint` | `rgba(245, 158, 11, 0.05)` | Faint amber row tint for the "you" row |
| `verified` | `#10B981` | Functional only — verified-state badges |
| `rejected` | `#B91C1C` | Functional only — rejected/disqualified label |

**Amber budget.** Amber is the most valuable pixel in Forge. It earns its scarcity. The places it is allowed to appear:

1. The top-3 rank Roman numerals.
2. The 2px left-border on top-3 rows.
3. The "you" marker word in serif italic on the viewer's own row.
4. The current-day cell border in the campaign progress strip.
5. The completed-day cells in the campaign strip (fill).
6. The single horizontal rule that *is* the cut.
7. The "the cut" label sitting on that rule.
8. The deltas of exactly two participants: the one who just crossed into the prize zone (`↑n`) and the one who just fell out of it (`↓n`).
9. The "view all →" link at the table footer.
10. Inline links and primary CTAs across the rest of the app.

Anywhere else, amber is forbidden. If you find yourself reaching for amber to "emphasize" something, the answer is type weight, type size, or position — not color.

### 5.2 Typography — three faces

Loaded via `next/font/google`:

```ts
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
```

Apply variables on `<html>` so Tailwind utilities `font-serif`, `font-sans`, `font-mono` work via the tokens layer.

**Typographic system rule — memorize this:**

> Instrument Serif italic is reserved for primary numbers and moments. Geist Mono is reserved for data. Geist Sans is everything else.

Where Instrument Serif italic appears across the product:

- Leaderboard rank numerals (Roman for top 3, Arabic for the rest).
- The personal dashboard's total hours figure (96px on mobile, 128px on desktop).
- The challenge day count in the header (`xiv ╱ xx`).
- Prize tier amounts on the rules page (`₦20,000 · ₦15,000 · ₦10,000`).
- The "the cut" divider label.
- The "you" marker on the leaderboard.
- The "Forge" wordmark itself.
- Countdown timers when they appear.
- Section H1s on standalone pages (challenge rules, about, etc.).

Where Geist Mono appears:

- Hours values in the leaderboard table.
- Day counts (e.g., the "14" in the days column).
- Deltas (`↑4`, `↓1`, `—`).
- Timestamps (`2h ago`, `4h`, `1d`).
- Footer summary lines.
- Any number that is data, not drama.

Everything else is Geist Sans. Two weights only — 400 regular, 500 medium. **Do not use 600 or 700.** Heavy weights look heavy against the rest of the system. If you need more emphasis than 500, switch to a different face (Instrument Serif) or a larger size — not a heavier weight.

### 5.3 Type scale (mobile baseline; scale up only on desktop)

| Element | Size | Face | Weight | Notes |
|---|---|---|---|---|
| Hero number (personal total) | 80px | Serif italic | 400 | line-height 1, mobile; 128px on desktop |
| Page H1 | 36px | Serif | 400 | "Leaderboard", "The Exam Flame" |
| Top-3 rank numeral | 32px | Serif italic | 400 | 38px on desktop |
| Rank 4+ numeral | 22px | Serif italic | 400 | 26px on desktop |
| Body | 14px | Sans | 400 | Default for all reading text |
| Body emphasized | 14px | Sans | 500 | "Your" row, primary CTA labels |
| Hours value (top 3) | 16px | Mono | 500 | 17px on desktop |
| Hours value (rank 4+) | 14px | Mono | 400 | 15px on desktop |
| Column headers | 10px | Sans | 400 | letter-spacing 0.18em |
| Eyebrow labels | 10px | Sans | 400 | letter-spacing 0.22em |
| Metadata (timestamps, deltas, courses) | 11–12px | Mono / Sans | 400 | |

### 5.4 Spacing & layout

- Page horizontal padding on mobile: **20px**. On desktop: **28px**. No exceptions.
- Vertical rhythm: 32px between sections; 22px between subsections; 14px between paragraphs.
- Top-3 row vertical padding: 20px. Standard row padding: 14px. The extra 6px of vertical breath is what gives the podium its weight.
- Border-radius: **`rounded-md` (6px)** for inputs, buttons, dropzones. **`rounded-none` (0px)** for table rows, dividers, anything full-width. **Never `rounded-2xl` or `rounded-3xl`.**
- Borders, not shadows. The only shadow allowed in the entire app is the iOS-style 1px hairline on the bottom-tab-bar top edge. No `shadow-lg`, no `shadow-md`, nothing.

### 5.5 Interaction patterns

- Primary buttons: `bg-amber-500 text-black font-medium rounded-md py-3 px-5`, active state `active:bg-amber-600`, full width on mobile.
- Secondary buttons: `border border-zinc-700 text-zinc-100 rounded-md py-3 px-5 hover:border-zinc-500`, transparent background.
- Form inputs: `bg-zinc-950 border border-zinc-800 rounded-md py-3 px-4 text-zinc-100 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20`.
- File dropzones: `border-2 border-dashed border-zinc-700 rounded-md py-12 hover:border-amber-500 transition-colors` — only place where `border-dashed` is allowed.
- All transitions: 150ms ease-out. No exceptions. No spring animations, no bouncy easings.
- Pressed/active states scale to 98% (`active:scale-[0.98]`) only on touch targets ≥48px.

---

## 6. Visual Identity — The Mockup, Described in Full

**Critical context: You (Claude Code) cannot see the leaderboard mockup we built during design. The description below is the canonical source of truth. Read it twice before writing a line of code for the leaderboard.**

### 6.1 The leaderboard page — the hero surface

The viewport is dark. Background `#0A0A0B`, primary text `#FAFAFA`. The page is full-bleed on mobile (no card wrapper); on desktop the table sits in a centered column up to ~1100px wide with the same 28px horizontal padding.

**Header region (top of page):**

Top-left corner contains an eyebrow label reading "forge · the exam flame" in 10px Geist Sans, all-lowercase, color `#71717A`, with `letter-spacing: 0.22em`. Below it, with 8px gap, the word **Leaderboard** in 36px Instrument Serif (regular, not italic), color `#FAFAFA`, line-height 1.

Top-right corner contains the campaign indicator. First line: the text `xiv ╱ xx` in 18px Instrument Serif italic — "xiv" in `#FAFAFA`, the slash and "xx" in `#52525B`. Below it, with 8px gap, a horizontal strip of 20 small rectangles. Each rectangle is 7px wide × 12px tall on mobile (8px × 14px on desktop), separated by 2px gaps. The first 13 are filled solid `#F59E0B`. The 14th is transparent with a 1px `#F59E0B` border (today, in progress). The remaining 6 are transparent with a 1px `#27272A` border. Below the strip, with 8px gap, in 11px Geist Mono color `#71717A`, the text "Updated 2 min ago".

A 1px `#27272A` horizontal rule separates the header from the table.

**Column headers (sub-row above the table):**

A 7-column grid: `56px 32px 1fr 80px 40px 70px 50px` with 14px column gaps. Label row in 10px Geist Sans lowercase, color `#71717A`, `letter-spacing: 0.18em`. Labels are: "rank", "" (blank — the delta column), "reader", "hall", "days", "hours", "last". Padding: 0 above, 12px below. The "rank" header is right-aligned within its column; "days", "hours", "last" are right-aligned; the rest are left-aligned.

**Top 3 rows (positions I, II, III):**

Each top-3 row is a 7-column grid with the same column template. Row padding: 20px top and bottom, 12px right, 16px left. A 2px `#F59E0B` left border accents the entire row height. A 1px `#27272A` top border separates rows.

Column 1 (rank): Roman numeral "I", "II", "III" in 32px Instrument Serif italic, color `#F59E0B`, line-height 1, right-aligned within the 56px column.

Column 2 (delta): The delta indicator in 11px Geist Mono, center-aligned. Position I (Prince) shows "—" in `#52525B` — he was already in the lead. Position II shows "↑1" in `#D4D4D8` (movement up since last update). Position III shows "↓1" in `#71717A` (movement down).

Column 3 (reader): Two stacked lines. Top line: full name in 14px Geist Sans weight 400, color `#FAFAFA`. Bottom line, with 3px gap: course in 12px Geist Sans, color `#71717A`.

Column 4 (hall): Hall name in 13px Geist Sans, color `#A1A1AA`, left-aligned.

Column 5 (days): Verified days in 13px Geist Mono, color `#A1A1AA`, right-aligned.

Column 6 (hours): Total verified hours in 16px Geist Mono weight 500, color `#FAFAFA`, right-aligned. Use `font-feature-settings: 'tnum'` or `text-tabular-nums` so digits align across rows.

Column 7 (last): Time since last verified submission, in 11px Geist Mono, color `#71717A`, right-aligned. Format: `2h`, `4h`, `1d`. Past 24h → switch to days. Past 7d → switch to date.

**Position 02 — the "you" row treatment:**

If the viewer is logged in and looking at their own row, three additional visual treatments apply, regardless of the row's rank:

1. Row background tinted `rgba(245, 158, 11, 0.05)`. Almost invisible — it should read as "warm" not "highlighted."
2. The participant's name renders in Geist Sans weight **500** instead of 400.
3. Immediately after the name, on the same baseline with 8px gap, the word **you** appears in 12px Instrument Serif italic, color `#F59E0B`.

These three treatments stack with any top-3 treatment — the "you" indicator works at every rank.

**Positions 4 through 15 — standard rows:**

Same column grid. Row padding: 14px vertical, 12px right, 18px left. 1px `#27272A` top border between rows. No left accent border.

Column 1 (rank): Arabic two-digit number (`04`, `05`, ..., `15`) in 22px Instrument Serif italic, color `#A1A1AA`, right-aligned in the 56px column.

Column 6 (hours): 14px Geist Mono weight 400, color `#FAFAFA`, right-aligned.

All other columns: identical treatment to top-3 rows.

**The cut — the divider between positions 15 and 16:**

A single horizontal element with 22px top padding and 18px bottom padding. The element itself: a flex container, items center-aligned, with 16px gap between three children:

1. Left child: the text **the cut** in 13px Instrument Serif italic, color `#F59E0B`, `letter-spacing: 0.04em`. Lowercase.
2. Middle child: a `flex: 1` div, 1px tall, background `#27272A`. This is the visual rule that "extends from" the label.
3. Right child: a tagline like **"7.5 hrs to cross"** in 11px Geist Mono, color `#71717A`. The 7.5 is dynamic — it's the current gap between position 16 and position 15.

The entire divider is preceded by a 1px solid `#F59E0B` top-border on the container, which gives the appearance that the cut label sits on the rule.

**Positions 16+ — the dimmed zone:**

Same grid. Row padding: 14px vertical, 12px right, 18px left. 1px `#18181B` (darker than the standard border) top border between dimmed rows.

Column 1 (rank): Arabic numeral in 22px Instrument Serif italic, color `#52525B` (much darker than the prize-zone color).

Column 3 (reader): Name in 14px Geist Sans color `#A1A1AA`. Course in 12px color `#52525B`.

Column 4 (hall): 13px Geist Sans color `#71717A`.

Column 5 (days): 13px Geist Mono color `#71717A`.

Column 6 (hours): 14px Geist Mono color `#A1A1AA`.

Column 7 (last): 11px Geist Mono color `#52525B`.

Column 2 (delta): same color logic as prize-zone rows (`↑` in `#D4D4D8`, `↓` in `#71717A`, `—` in `#3F3F46`) — **except** when a participant has just been ejected from the prize zone, in which case their `↓n` delta renders in `#F59E0B`. Similarly, the participant who has just been bumped into the prize zone shows their `↑n` delta in `#F59E0B`. This is the only place amber appears in the deltas, and only ever applies to at most two rows at a time.

**Disqualified rows — special treatment, regardless of position:**

A disqualified row is sorted to the very bottom of the leaderboard, after all active rows. Disqualified rows do not contribute to position calculations for other rows — if 87 are active and 1 is disqualified, ranks run 1 through 87.

Disqualified row visual treatment:
- Rank numeral in `#3F3F46`.
- Delta column: `—` in `#3F3F46`.
- Name in `#52525B` with CSS `text-decoration: line-through`.
- Immediately after the name, with 8px gap, the word **disqualified** in 12px Instrument Serif italic, color `#B91C1C`, with **no strikethrough on the label itself**.
- Course in `#3F3F46`.
- Hall in `#52525B`.
- Days value in `#52525B`.
- Hours value in `#52525B` with `text-decoration: line-through`.
- Last value in `#3F3F46`.

**Footer:**

After the last row, a 24px top padding precedes a flex container with `justify-content: space-between`:

- Left: in 11px Geist Mono color `#71717A` with `letter-spacing: 0.06em`, the summary line — `"{n} readers · {total} verified hours · {dq} disqualified"`. Comma not present; em-space dots between segments.
- Right: in 11px Geist Mono color `#F59E0B`, the text `"view all →"` (a link to the full roster if pagination is used; in V1 the full roster is always rendered).

The footer is preceded by a 1px `#27272A` top border with 12px margin-top.

### 6.2 The personal dashboard — `/you`

The viewport opens with an eyebrow label "you" in tracked lowercase, color `#71717A`. Below it, the participant's full name in 36px Instrument Serif. Below that, their course, hall, and academic level on one line, separated by middle dots, in 13px Geist Sans color `#71717A`.

Then comes the **hero number**. The participant's total verified hours, rendered in **80px Instrument Serif italic**, color `#FAFAFA`, line-height 1. Below it, with 8px gap, the word "hours" in 12px Geist Sans tracked lowercase, color `#71717A`.

Immediately below the hero number, **the rivalry block** — two stacked rows:

```
Chasing      Samuel Idi          +2.5 ahead
Chased by    David Olubi         −1.0 behind
```

Format: a label in 11px Geist Sans tracked lowercase color `#71717A` (left), the participant's name in 14px Geist Sans color `#FAFAFA` (middle), and the gap in 14px Geist Mono — color amber for "ahead" (you need to close it), color `#A1A1AA` for "behind" (you have a lead). If the user is rank 1, the "Chasing" row is replaced by "Leading the field" in serif italic. If the user is the last active rank, the "Chased by" row reads "No one chasing you yet" in tertiary text.

Below the rivalry block, **the rank block**:

```
You are #2 of 87 active
4.5 hrs above the cut
```

Format: in 13px Geist Sans, color `#FAFAFA` for the rank position and color `#71717A` for the descriptors. The "above the cut" / "below the cut" line is colored amber if below; tertiary if above by more than 5 hours; primary if above by less than 5 hours (i.e., in danger).

Below that, **the campaign strip** — same component as the leaderboard header but larger here. 20 cells in a row, each 12px × 18px on mobile, 4px gaps. Each cell renders the user's submission for that day:
- **Verified day** (submission confirmed): solid amber fill.
- **Pending day** (submission awaiting review): amber background with diagonal stripe pattern (`background: repeating-linear-gradient(45deg, #F59E0B, #F59E0B 2px, transparent 2px, transparent 4px)`).
- **Rejected day**: solid `#B91C1C` fill.
- **Today, not yet submitted**: 1px amber border, transparent fill.
- **Future day**: 1px `#27272A` border, transparent fill.
- **Skipped past day**: 1px `#52525B` border, transparent fill.

Below the campaign strip, 16px gap, then a list of submissions in reverse chronological order. Each submission row:
- Day number (e.g., "Day 14") in 14px Geist Sans color `#FAFAFA`.
- Hours in 13px Geist Mono, right-aligned. Color depends on status: white for verified, amber for pending, red for rejected.
- Status badge below the day in 11px Instrument Serif italic, matching color.
- Topic in 12px Geist Sans color `#A1A1AA`, truncated to one line.
- A 1px `#27272A` divider between rows.

Tapping a submission row reveals the full submission detail: full topic, screenshot thumbnail, submitted-at timestamp, rejection reason if rejected.

### 6.3 The submission form — `/submit`

This is the highest-friction screen and must feel the most generous.

Header: an eyebrow "submit" in tracked lowercase, then "Day 14" in 36px Instrument Serif. Below it, the date in 13px Geist Sans color `#71717A` (e.g., "Monday, 30 June 2026 · Africa/Lagos").

Then the form, single-column, 20px gap between fields, no card wrapper:

1. **Hours read** — large number input. 14px label "Hours read today" in Geist Sans color `#71717A`. Input element rendered LARGE: 32px Instrument Serif italic, color `#FAFAFA`, right-aligned, full-width, `bg-transparent`, no border except a 1px `#27272A` bottom border that becomes amber on focus. Pattern: accept decimals (e.g., `8.5`). `inputmode="decimal"`. Max 24, min 0.1. Server-validated.

2. **Topic** — a single-line text input. Label "What did you study?" Placeholder "e.g., Engineering economics, Chapter 5". Max 120 characters. Standard input styling per §5.5.

3. **Screenshot** — a full-width file dropzone. 1px dashed `#3F3F46` border, `rounded-md`, 160px tall, centered icon (small camera icon, 24px, color `#71717A`), label "Tap to upload your timer screenshot" in 14px Geist Sans color `#A1A1AA`. On tap: opens the device camera/gallery picker. On selection: the dropzone replaces its content with a preview of the image (object-fit cover, full dropzone height), with the filename and OCR-extracted hours displayed below in 12px Geist Mono color `#71717A`. A small `× Remove` text button appears in the top-right of the preview.

4. **WhatsApp post time (optional but encouraged)** — a single-line text input. Label "What time did you post in the WhatsApp group?" Placeholder "e.g., 22:14". Helps admins cross-reference. Accepts free text; not validated.

5. **Submit button** — full-width, amber, `py-4`, 16px label "Submit for verification" in Geist Sans weight 500 color black. Disabled state: `bg-zinc-800 text-zinc-500`. Disabled until hours, topic, and screenshot are present.

After successful submission, **the response screen is a moment, not a toast.** The form is replaced by:

- A serif italic "Done." in 36px, color `#FAFAFA`.
- A line of body text: "Day 14 logged. Awaiting verification."
- The user's current rank and distance from the cut, in the same format as the personal dashboard's rank block.
- A primary button "View leaderboard" that routes to `/leaderboard`.
- A secondary text link "Submit another day" (only if the previous day is unsubmitted).

### 6.4 Authentication screens

**Auth landing — `/auth`:**

Centered vertically on the viewport. Top of the centered block: the word **Forge** in 32px Instrument Serif italic, color `#F59E0B`. Below it, in 14px Geist Sans color `#A1A1AA`, a single line: "Where readers go to war." Below that, with 48px gap, the email input with label "Enter your email", standard input styling, full width, autocomplete `email`. Below it, with 12px gap, the primary submit button "Send code" — full width, amber.

That's it. No marketing text. No feature grid. No testimonials. No "Sign in with..." section in V1.

**Code entry — `/auth/verify`:**

Same vertical layout. Header swaps to "Check your email" in 32px Instrument Serif. Body: "We sent a 6-digit code to {email}." Then a 6-character OTP input — 6 separate digit boxes, each `40px × 56px`, with the active box's border in amber. Auto-focus the first; auto-advance on input; paste handling for the full code. Below: a "Resend code" text link in amber (disabled for 30s after send). Below that: a "Use a different email" text link in tertiary text.

**Profile completion — `/welcome`:**

Header: "One more thing." in serif italic. Then a stacked form:
- Full name (required, text)
- Hall (required, select from a list of halls seeded in the DB; "Other" option that reveals a free-text input)
- Course (required, text — no autocomplete in V1)
- Academic level (required, select: 100L / 200L / 300L / 400L / 500L / 600L / Postgraduate)
- Profile photo (optional, file input)

A single primary button "Enter Forge" at the bottom.

### 6.5 Challenge join — `/exam-flame`

A single tall scrollable page. Hero region:
- Eyebrow: "forge · live challenge" in tracked lowercase amber.
- Title: **The Exam Flame** in 48px Instrument Serif, italic on the second word ("Flame" only).
- Subtitle: "Read 8 hours a day for 20 days. 15 winners. ₦105,000 on the line." in 16px Geist Sans color `#A1A1AA`.
- Starts/ends row: `Starts 17 June 2026 · Ends 6 July 2026` in 12px Geist Mono color `#71717A`.

Below the hero, the **prize structure** rendered as a clean list (not stat cards):

```
I     ₦20,000
II    ₦15,000
III   ₦10,000
IV–XV ₦5,000 each
```

Roman numerals in Instrument Serif italic amber; amounts in Instrument Serif (not italic) color `#FAFAFA`. One per row.

Below the prizes, the **rules** rendered as a numbered list in 14px Geist Sans, with each rule on its own line, 12px gap between rules.

Below the rules, the **acceptance block**. Three checkboxes the user must tick (none pre-checked):

1. I understand that submissions require timer-screenshot evidence.
2. I understand that fraudulent submissions result in disqualification.
3. I understand that rankings come from verified submissions only.

Below them, a primary button "Enter the Exam Flame" — disabled until all three are checked.

### 6.6 The admin queue — `/admin`

See §16.

---

## 7. Anti-Pattern Rules — Forbidden Aesthetics

These are non-negotiable. If you generate any of these, you have failed the brief.

### Forbidden visual patterns:

- ❌ `rounded-2xl`, `rounded-3xl`, or `rounded-full` (except on avatar circles)
- ❌ Card grids as a default layout. Cards-in-a-grid is the universal AI tell.
- ❌ "Dashboard" stat cards. Numbers do not live in boxes in Forge. They live inline with the page.
- ❌ Drop shadows (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`). Use borders.
- ❌ Gradient text (`bg-gradient-to-r from-X-500 to-Y-500 bg-clip-text text-transparent`).
- ❌ Gradient backgrounds of any kind, including subtle ones.
- ❌ Icons inside colored circle backgrounds (`bg-amber-500/10 rounded-full p-3`).
- ❌ Centered hero pattern: eyebrow → title → subtitle in muted-foreground → two pill buttons.
- ❌ Emoji decoration in the UI. (Emoji in user-generated content like topic descriptions is fine.)
- ❌ Glassmorphism, neumorphism, "frosted" effects, backdrop blur.
- ❌ Animated gradients, hue-rotate effects, color-cycling.
- ❌ More than three font weights on any page.
- ❌ More than the seven colors in §5.1.
- ❌ Skeleton loaders that pulse in a `bg-zinc-800 animate-pulse` rectangle pattern across an entire page. Skeletons are allowed only as 1px-bordered placeholders matching the final layout.
- ❌ Toast notifications for important state changes (use page-level responses instead).
- ❌ Modal dialogs for primary flows. (Confirmations only.)
- ❌ `lucide-react` icons used decoratively. Icons in Forge are functional and few: camera (upload), check (verified), x (rejected/close), arrow-up/arrow-down (deltas — but use Unicode arrows, not SVG), search (only in admin queue). Nothing else.

### Forbidden copy patterns:

- ❌ "Welcome back, {name}!" — exclamation marks in greetings are forbidden.
- ❌ "Submission received successfully!" — successfully is filler.
- ❌ "Oops! Something went wrong." — never "oops" anywhere.
- ❌ "Loading..." — use the empty layout, not a word.
- ❌ "Click here to..." — write the destination as the link text.
- ❌ Title Case in body copy.
- ❌ All-caps shouting. The only uppercase allowed is tracked-out small labels at 10–11px with `letter-spacing ≥ 0.18em`.

### Required copy patterns:

- ✅ "the cut" not "PRIZE LINE" or "Qualification threshold"
- ✅ "Disqualified" not "Removed" or "Invalidated"
- ✅ "Awaiting verification" not "Pending review"
- ✅ "Confirmed" not "Approved ✓"
- ✅ "No blood drawn yet. Be the first." for empty leaderboards
- ✅ "You moved up two places." for post-submission feedback
- ✅ "7.5 hrs to cross" for sub-cut distance

---

## 8. Database Schema

All tables exist in the `public` schema unless noted. Postgres. UUIDs everywhere except where text slugs are stable identifiers.

```sql
-- Halls. Seeded at deploy time with the known list.
create table halls (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  created_at  timestamptz not null default now()
);

-- Profiles. Extends auth.users via FK on id.
create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text not null,
  hall_id            uuid references halls(id),
  course             text not null,
  academic_level     text,
  phone              text,
  avatar_url         text,
  role               text not null default 'participant'
                     check (role in ('participant','admin','superadmin')),
  is_suspended       boolean not null default false,
  suspension_reason  text,
  created_at         timestamptz not null default now()
);

-- Challenges. The platform supports many; V1 launches with one.
create table challenges (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  name                  text not null,
  description           text,
  rules                 text,
  start_date            date not null,
  end_date              date not null,
  duration_days         int generated always as ((end_date - start_date) + 1) stored,
  prize_structure       jsonb not null default '[]'::jsonb,
  prize_line_position   int not null default 15,
  ranking_rule          text not null default 'hours_then_days_then_earliest',
  status                text not null default 'draft'
                        check (status in ('draft','active','verification','completed','archived')),
  timezone              text not null default 'Africa/Lagos',
  daily_hour_ceiling    numeric(4,1) not null default 24.0,
  submission_window_hrs int not null default 36,
  created_at            timestamptz not null default now()
);

-- Challenge participants. Explicit join.
create table challenge_participants (
  id                       uuid primary key default gen_random_uuid(),
  challenge_id             uuid not null references challenges(id) on delete cascade,
  participant_id           uuid not null references profiles(id) on delete cascade,
  joined_at                timestamptz not null default now(),
  rules_accepted_at        timestamptz not null,
  is_disqualified          boolean not null default false,
  disqualification_reason  text,
  disqualified_at          timestamptz,
  disqualified_by          uuid references profiles(id),
  flag_count               int not null default 0,
  unique (challenge_id, participant_id)
);

-- Submissions.
create table submissions (
  id                    uuid primary key default gen_random_uuid(),
  challenge_id          uuid not null references challenges(id),
  participant_id        uuid not null references profiles(id),
  challenge_day         int not null,
  hours_claimed         numeric(4,1) not null check (hours_claimed > 0 and hours_claimed <= 24),
  hours_credited        numeric(4,1),
  topic                 text not null,
  screenshot_path       text not null,
  screenshot_phash      text not null,
  ocr_extracted_hours   numeric(4,1),
  whatsapp_post_time    text,
  status                text not null default 'pending'
                        check (status in ('pending','confirmed','rejected')),
  submitted_at          timestamptz not null default now(),
  reviewed_at           timestamptz,
  reviewed_by           uuid references profiles(id),
  rejection_reason      text,
  internal_notes        text,
  flag_reasons          text[] not null default '{}',
  client_ip             inet,
  client_fingerprint    text,
  unique (challenge_id, participant_id, challenge_day)
);

-- Appeals.
create table appeals (
  id                      uuid primary key default gen_random_uuid(),
  submission_id           uuid not null references submissions(id),
  participant_explanation text not null,
  additional_evidence_path text,
  status                  text not null default 'pending'
                          check (status in ('pending','upheld','restored')),
  created_at              timestamptz not null default now(),
  resolved_at             timestamptz,
  resolved_by             uuid references profiles(id)
);

-- Immutable audit log.
create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references profiles(id),
  action          text not null,
  entity_type     text not null,
  entity_id       uuid not null,
  previous_state  jsonb,
  new_state       jsonb,
  created_at      timestamptz not null default now()
);

-- Product analytics.
create table events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id),
  name       text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
```

**Row Level Security policies (mandatory):**

- `profiles`: readable by all authenticated users (for display on the leaderboard); only the owner can update; only superadmins can change `role`.
- `challenges`: readable by everyone (public); only superadmins can insert/update.
- `challenge_participants`: readable by everyone; insert allowed for `auth.uid() = participant_id`; updates restricted to admins/superadmins.
- `submissions`: readable by the owner, admins, and superadmins; insert allowed for `auth.uid() = participant_id` with `status = 'pending'`; updates of `status`, `hours_credited`, `reviewed_at`, `reviewed_by`, `rejection_reason`, `internal_notes`, `flag_reasons` restricted to admins/superadmins.
- `audit_log`: insert-only for authenticated callers via security-definer functions; no public reads in V1.

**Leaderboard SQL function** — the hot path. Cache its output at the Next.js layer with `revalidate: 30`:

```sql
create or replace function get_leaderboard(p_challenge_id uuid)
returns table (
  rank             int,
  participant_id   uuid,
  full_name        text,
  course           text,
  hall_name        text,
  verified_days    int,
  total_hours      numeric,
  earliest_submission timestamptz,
  last_submission  timestamptz,
  is_disqualified  boolean
)
language sql stable as $$
  with active as (
    select
      cp.participant_id,
      p.full_name,
      p.course,
      h.name as hall_name,
      count(s.id) filter (where s.status = 'confirmed') as verified_days,
      coalesce(sum(s.hours_credited) filter (where s.status = 'confirmed'), 0) as total_hours,
      min(s.submitted_at) filter (where s.status = 'confirmed') as earliest_submission,
      max(s.submitted_at) filter (where s.status = 'confirmed') as last_submission,
      cp.is_disqualified
    from challenge_participants cp
    join profiles p on p.id = cp.participant_id
    left join halls h on h.id = p.hall_id
    left join submissions s
      on s.participant_id = cp.participant_id
      and s.challenge_id = cp.challenge_id
    where cp.challenge_id = p_challenge_id
    group by cp.participant_id, p.full_name, p.course, h.name, cp.is_disqualified
  )
  select
    row_number() over (
      order by
        is_disqualified asc,
        total_hours desc,
        verified_days desc,
        earliest_submission asc nulls last
    )::int as rank,
    *
  from active;
$$;
```

---

## 9. Authentication — Concrete Specification

**V1: Email OTP only.** Phase 2: Google OAuth.

### Flow

1. User opens `/auth` (or is redirected there from any protected route).
2. Enters email.
3. Supabase Auth sends a 6-digit OTP to the email (`signInWithOtp({ email, options: { shouldCreateUser: true } })`).
4. User enters the OTP on `/auth/verify`.
5. On success, Supabase returns a session. The middleware reads the session cookie and routes the user.
6. If the user has no `profiles` row, redirect to `/welcome` for profile completion.
7. If they have a profile but haven't joined the active challenge, redirect to `/exam-flame`.
8. Otherwise, land on `/leaderboard`.

### Sessions

- 30-day session duration via Supabase Auth defaults.
- Automatic refresh-token rotation on every authenticated request.
- httpOnly cookies for the session token. Never read the access token from JavaScript outside the Supabase client.
- Sign out clears the session and redirects to `/auth`.

### Roles

- Default: `participant`.
- Role elevation is only possible via direct SQL update by a superadmin (V1) or via the SuperAdmin Console (Phase 2).
- Hardcode the initial superadmin's email in an environment variable `SUPERADMIN_EMAIL`. A SQL migration at deploy time sets `role = 'superadmin'` for that profile.

### Protected routes

- `/leaderboard`, `/you`, `/submit`, `/exam-flame` — require authentication.
- `/admin/**` — requires `role in ('admin', 'superadmin')`.
- `/admin/console/**` — requires `role = 'superadmin'` only.
- `/`, `/auth`, `/auth/verify` — public.

Route protection is enforced in **`middleware.ts`** at the edge (fast) and **re-verified server-side on every protected page's Server Component** (correct). Never trust client-side role checks alone.

### Identity routing

- Challenge invite links (e.g., `forge.app/exam-flame`) must be public. Unauthenticated users hitting them are redirected to `/auth?next=/exam-flame` and bounced back to the original URL on auth success.

---

## 10. Challenge Architecture

Forge is challenge-first. The platform must support multiple challenges over time.

### V1 scope

- One challenge is seeded at deploy time: **The Exam Flame**, slug `exam-flame`.
- The challenge's `status` is `draft` until the launch moment, when it flips to `active`.
- The participant-facing UI in V1 may hardcode references to the slug `exam-flame`. The schema and admin layer must remain challenge-agnostic.

### Challenge lifecycle

`draft → active → verification → completed → archived`

State transitions are SuperAdmin-only. The system enforces:

- Submissions accepted only when `status = 'active'`.
- Leaderboard publicly visible when `status in ('active', 'verification', 'completed')`.
- After `archived`, the challenge becomes read-only.

### Prize structure (JSONB on challenges)

```json
[
  { "position": 1, "amount": 20000, "label": "I" },
  { "position": 2, "amount": 15000, "label": "II" },
  { "position": 3, "amount": 10000, "label": "III" },
  { "positions": [4, 15], "amount": 5000, "label": "IV–XV" }
]
```

### Daily submission window

- Each challenge day runs from 00:00 to 23:59 in the challenge's timezone (`Africa/Lagos`).
- A submission for Day N is accepted between Day N 00:00 and Day N+1 23:59 (a 48-hour window — generous enough for late-night reading, strict enough to prevent backfill abuse).
- The `challenge_day` value is computed server-side from the current Lagos-time date. Never trust the client to provide it.
- The `daily_hour_ceiling` on `challenges` is set to `24.0` for Exam Flame — only the physical cap applies. Future challenges may set it lower.

### Hall participation (Phase 2)

The `halls` table and `profiles.hall_id` column exist from V1. Hall competitions (aggregating hours across hall members for a hall-vs-hall scoreboard) are deferred to Phase 2 but require **no schema changes** to enable. A future `challenge_hall_mode` column on `challenges` will turn on the hall scoreboard UI.

---

## 11. Submission Architecture

### What a submission contains

- Hours claimed (decimal, 0.1–24.0).
- Topic (text, up to 120 chars).
- Screenshot path (Supabase Storage).
- Perceptual hash of screenshot (server-computed at upload).
- OCR-extracted hours (optional, client-computed via Tesseract.js, server-validated).
- WhatsApp post timestamp (optional, free text).
- Submission timestamp (server-set).
- Client IP and rough fingerprint (collected silently for fraud detection; never displayed to participants).

### Upload flow

1. Client compresses the screenshot to ≤1500px on the longest edge using `canvas` (skip if already smaller). Quality 0.85 JPEG.
2. Client requests a signed upload URL from a Server Action `requestUploadUrl(challengeId, day)`.
3. Server Action validates: user is enrolled, day is in submission window, no existing submission for this day. Returns a signed URL valid for 60 seconds, scoped to `submissions/{challenge_slug}/{participant_id}/{day}.jpg`.
4. Client PUTs the file directly to the signed URL.
5. Client invokes Server Action `createSubmission(...)` with the storage path, hours, topic, OCR result.
6. Server: re-validates everything; downloads the uploaded image; computes pHash with sharp; checks against all prior submissions from this user for the same challenge (any pHash within hamming distance 5 → reject with reason "duplicate_screenshot"); inserts the submission row with `status = 'pending'`; calls `revalidatePath('/leaderboard')` and `revalidatePath('/you')`.

### Verification states

- **pending** → submitted, awaiting admin review. Counts toward nothing.
- **confirmed** → reviewed and accepted. `hours_credited = hours_claimed`. Counts toward leaderboard.
- **rejected** → reviewed and refused. `rejection_reason` populated. Counts toward nothing. Participant can file an appeal.

State transitions are admin-only and audited.

### Auto-flagging (no auto-rejection)

The server flags submissions for admin attention but never auto-rejects. Flags are stored in `flag_reasons text[]`:

- `duplicate_phash` — identical or near-identical to a prior submission.
- `ocr_mismatch` — OCR-extracted hours differ from claimed hours by more than 30 minutes.
- `excessive_hours` — claimed hours > 16 (physically possible but suspicious).
- `submission_window_late` — submitted in the late half of the window.
- `participant_flagged` — participant has 2+ previously rejected submissions.

Admins see flagged submissions sorted to the top of the queue.

### Anti-fraud — what we explicitly do not do

- We do not track keystrokes.
- We do not silently record device sensors.
- We do not require GPS.
- We collect IP for fraud-pattern detection and we are transparent about it in the rules.

---

## 12. Leaderboard Engine

### Ranking rule (Exam Flame)

```
ORDER BY
  is_disqualified ASC,           -- not-disqualified first
  total_verified_hours DESC,
  verified_days DESC,             -- fewer-day pace earns rank in ties
  earliest_confirmed_submission ASC NULLS LAST  -- the first to hit a tied total wins
```

The function `get_leaderboard(challenge_id uuid)` returns the ranked list. It is **stable** so Postgres can cache execution.

### Caching strategy — the hot path

The leaderboard is the most-hit page in Forge. Its TTFB target is **under 300ms on warm requests, under 1.2s on cold**. Strategy:

1. The leaderboard page is a **Server Component** with `export const revalidate = 30`. Next.js Incremental Static Regeneration regenerates the page every 30 seconds at most.
2. On any submission state change (insert, confirm, reject), a Server Action calls `revalidatePath('/leaderboard')` so the next render is fresh.
3. The leaderboard query selects exactly the columns shown on screen — no `SELECT *`.
4. The deltas (movement since the last leaderboard refresh) are computed by comparing the current snapshot to a stored snapshot of the previous "leaderboard period." The challenge has a configured update cadence (every 4 days for Exam Flame). At each cadence boundary, the SuperAdmin (or a cron job) triggers a snapshot insert into a `leaderboard_snapshots` table. Deltas on the live leaderboard compare against the most recent snapshot.

### The leaderboard_snapshots table

```sql
create table leaderboard_snapshots (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id),
  taken_at        timestamptz not null default now(),
  rankings        jsonb not null
);

create index idx_snapshots_challenge_taken on leaderboard_snapshots (challenge_id, taken_at desc);
```

`rankings` stores the full ranked list at the snapshot moment: `[{participant_id, rank, total_hours}, ...]`.

The leaderboard view computes deltas by joining the current `get_leaderboard()` result against the most recent snapshot. Participants not present in the prior snapshot show `↑NEW`.

### The "you" view

When a participant loads `/leaderboard`, the server reads their session, computes the leaderboard, finds their row, and attaches the "you" treatment server-side. The "you" row is identified by `participant_id === session.user.id`. The treatment is pure CSS — no client-side hydration cost.

### Pagination

V1: render all participants on a single page. For 100–500 participants the rendered HTML is well under 200KB.
Phase 2: virtualize the table if total participants exceed 2000.

---

## 13. Mobile Screens — Page-by-Page

For each screen below: layout in 390px-wide viewport; component breakdown; interactions.

### 13.1 `/auth` — Auth landing

- Layout: full-height column, centered. Background `#0A0A0B`.
- Top region (top 30% of viewport): empty space.
- Middle region: vertical stack, 24px gap.
  - Word **Forge** in 32px Instrument Serif italic color amber.
  - Tagline "Where readers go to war." 14px Geist Sans color secondary.
- Lower region (50% of viewport): form.
  - Email input, full width, 48px tall, standard styling.
  - "Send code" button, full width, 52px tall, amber.
- Bottom region: 11px tracked microcopy "By continuing you accept the rules of the challenge you join." color tertiary.

### 13.2 `/auth/verify` — Code entry

- Same vertical layout as `/auth`.
- Title swap: "Check your email" 28px Instrument Serif.
- Body line: "We sent a 6-digit code to **you@example.com**." 14px Geist Sans.
- OTP input: 6 boxes, 44px × 56px each, 8px gap, monospace 22px in the boxes. Auto-focus first, auto-advance on input, paste handles the whole code.
- Resend link disabled for 30s post-send (countdown shown next to the link).

### 13.3 `/welcome` — Profile completion

- Header: "One more thing." 28px Instrument Serif italic.
- Stacked form: name → hall → course → academic level → photo (optional).
- Each field 48px tall, 16px gap between fields.
- Sticky bottom: primary button "Enter Forge", full width, amber.

### 13.4 `/exam-flame` — Challenge join

- Long scrollable page. Hero (described in §6.5). Prize list. Rules list. Acceptance checkboxes.
- Sticky bottom: "Enter the Exam Flame" button, disabled until all 3 checkboxes ticked.
- If already enrolled: the page replaces the join button with a "You're in" badge and a primary button "Go to leaderboard."

### 13.5 `/leaderboard` — The main view

- Full-bleed table (no horizontal padding on rows; only header has 20px page padding).
- Column structure on mobile narrows from desktop:
  - Mobile (<480px): `40px(rank) 24px(delta) 1fr(reader) 56px(hours)` — Hall, days, last collapse into the reader subline as `Hall · Days · Last`.
  - 480–767px: add the days column back.
  - 768px+: full 7-column desktop layout.
- The campaign strip in the header shrinks to 6px cells with 2px gaps on mobile (total ~150px).
- Tapping any row navigates to `/profile/{participant_id}` (a public profile, Phase 2; in V1 it shows just the participant's name, course, hall, verified days, total hours, and recent submissions thumbnail strip).
- Pull-to-refresh triggers `router.refresh()`.

### 13.6 `/you` — Personal dashboard

Layout described in §6.2. On mobile, the hero number reduces to 64px (instead of 80px) so it doesn't dwarf the rivalry block. The campaign strip is full-width with cells sized to fit (12px × 20px cells, 3px gaps).

A "Submit today's reading" sticky bottom bar appears only if today's submission hasn't been made. On tap, navigates to `/submit`.

### 13.7 `/submit` — Daily submission

Layout described in §6.3. On mobile, the hours input is huge — 48px Instrument Serif italic, centered, full-width below the label. The file input opens the camera directly (`capture="environment"`).

### 13.8 `/admin` — Admin queue (admins only)

Layout described in §16.

### 13.9 Tab bar (sticky bottom on all participant routes)

- Fixed bottom. Height 64px + `env(safe-area-inset-bottom)`.
- 1px top border `#27272A`.
- Background `#0A0A0B`.
- Three equal columns. Each cell is a flex column with the icon (20px Unicode glyph or inline SVG, color amber if active else `#71717A`) above the label (10px Geist Sans, same color).
- Routes: `/leaderboard` (📊→use inline SVG bars icon), `/submit` (+), `/you` (●).

Use inline SVGs, not emoji. The icons:
- Leaderboard: three vertical bars of varying height.
- Submit: a plus.
- You: a filled circle (avatar placeholder) or person silhouette.

---

## 14. Desktop Adaptation

Desktop is a graceful expansion of mobile, not a redesign.

- Max content width: 1100px, centered, 28px horizontal padding.
- The bottom tab bar becomes a slim left sidebar 200px wide. Icons grow to 24px; labels grow to 12px.
- The leaderboard goes full 7-column.
- The personal dashboard's hero number grows from 80px to 128px Instrument Serif italic. The rivalry block aligns to two columns instead of stacked.
- The submission form is constrained to 480px wide, centered, no longer stretches.
- Hover states activate (subtle row highlight on the leaderboard: `hover:bg-zinc-900/40`).

Keyboard navigation enabled everywhere: `Tab` cycles focusable elements; the admin queue gets `J/K` row navigation, `A` to approve, `R` to reject, `S` to skip.

---

## 15. Production Readiness

### Loading states

- The leaderboard page uses **Next.js Streaming**: the header renders immediately; the table streams in with a `<Suspense>` boundary showing a skeleton matching the grid (1px borders, no animated pulse, just empty rows).
- The personal dashboard streams the hero number first, then the campaign strip, then the submission list.
- The submission form has no global loading state; the submit button shows "Submitting…" inline.

### Empty states

- Empty leaderboard (no participants confirmed yet): centered serif italic "No blood drawn yet. Be the first." in 22px, with a CTA "Submit Day 1" below.
- Empty personal dashboard (no submissions yet): hero number renders "0.0" in serif italic; rivalry block reads "The race hasn't started for you yet." with a CTA to submit.
- Empty admin queue: "Queue clear. Refresh to check again." with a Refresh button.

### Error states

- Form submission errors render inline below the relevant field in 13px color `#B91C1C`.
- Server errors render as a small banner at the top of the page: "Something didn't go through. Try again." with a Retry button. Never use the word "oops" or "sorry."
- 404 page: serif italic "Nothing here." in 36px, secondary text "Find your way back to the cut." with a link to `/leaderboard`.

### Accessibility

- All inputs have associated labels (visible or `aria-label`).
- Focus rings on every focusable element: `focus:outline-none focus:ring-2 focus:ring-amber-500/40`.
- Color is never the only signal — status icons or text labels always accompany color-coded states.
- The leaderboard table uses proper `<table>`, `<thead>`, `<tbody>` semantics so screen readers can navigate it correctly.
- The "you" indicator includes both the visual treatment and an `aria-label="your row"`.

### SEO / OG

- Per-challenge OG image generated at the edge using `@vercel/og`. Image shows the challenge name in Instrument Serif amber, the top 3 podium with Roman numerals and names, the day count, and "the cut" line. Branded.
- Per-participant OG image (Phase 2) shows their rank, hours, and the campaign strip.

### PWA

- `manifest.json` with Forge icon, name, theme color `#0A0A0B`, background color `#0A0A0B`, display `standalone`.
- An "Add to Home Screen" prompt appears once, three days into the challenge, only if the user has submitted at least 2 days.
- No service worker / offline support in V1 (real-time data — caching is risky). Phase 2.

### Performance budgets

- Leaderboard page TTFB on warm: ≤ 300ms.
- Leaderboard page TTFB on cold: ≤ 1.2s.
- LCP on the leaderboard page: ≤ 1.8s on a fast 4G connection.
- Total JavaScript shipped on the leaderboard page: ≤ 60KB gzipped. (Server Components keep this low; do not pull in libraries that ship runtime code.)
- Largest image on any page: ≤ 200KB after compression.
- Web Vitals (CLS, INP) tracked via Vercel Speed Insights with alerts if any regress past p75 threshold.

---

## 16. Administrative & Governance Architecture

### Roles

- **Participant** — competes. Cannot see admin surfaces.
- **Admin** — verifies submissions. Cannot edit challenges or rankings directly.
- **SuperAdmin** — governs the platform. All admin permissions plus challenge management and role assignment.

### The admin queue — `/admin`

Single-purpose surface. No tabs, no charts, no analytics. The queue and nothing else.

**Layout (desktop):** two-pane.

- **Left pane (320px wide):** scrollable list of pending submissions, newest first, flagged submissions pinned to the top. Each row shows: participant name (14px Geist Sans), claimed hours in mono right-aligned, time since submission in tertiary text, and any flag pills (e.g., `dup_phash`, `ocr_mismatch`) in 10px tracked uppercase color red.
- **Right pane (everything else):** the currently selected submission's full detail.
  - Screenshot preview, large, with click-to-zoom.
  - Participant info block: name, course, hall, submission history summary ("12 confirmed, 1 rejected, 2 pending").
  - Claimed hours (large mono), OCR hours (smaller mono, color amber if there's a mismatch).
  - Topic, displayed in full.
  - WhatsApp post time if provided.
  - Three actions at the bottom, full width: **Confirm** (amber), **Reject** (zinc), **Skip** (text link). Reject reveals a single-line reason input before confirming the rejection.
  - Keyboard: `J/K` navigate the list, `A` approve, `R` reject (focuses reason field), `S` skip, `Enter` submits the current action.

**Mobile admin queue:** single-pane. Each tap shows the full submission detail; back-button returns to the list. The same actions live at the bottom of the screen, accessible to thumb.

### Moderation notes

Each submission has an `internal_notes` text field, editable by admins. Notes appear under the action buttons in the review pane. Notes are never visible to participants.

### Disqualification

Admins can disqualify a participant from the participant's profile in the admin surface. Disqualification requires a reason. It sets `is_disqualified = true` on `challenge_participants` with `disqualification_reason`, `disqualified_at`, `disqualified_by`. All previous submissions remain in the database; their hours stop counting. The disqualification appears in the audit log.

### Appeals (Phase 1.5)

A rejected submission gets an "Appeal this rejection" button on the participant's submission detail screen. Tapping opens a form: explanation (required, text), additional evidence (optional, file). Submitting creates an `appeals` row. Appeals appear in a separate queue tab in `/admin`. Admins can uphold the rejection (no change) or restore the submission (`status = 'confirmed'`).

### SuperAdmin Console (Phase 2)

A separate surface at `/admin/console` accessible only to superadmins. Manages: challenge creation and lifecycle transitions, role assignments, audit log viewing.

### Audit logging

Every admin action emits a row in `audit_log`. The write happens within the same transaction as the state change, so logs cannot diverge from reality.

Logged actions in V1:
- `submission.confirm`
- `submission.reject`
- `submission.notes_update`
- `participant.disqualify`
- `participant.flag`
- `challenge.status_transition`
- `role.assign`

---

## 17. Performance — The Traqly Lessons

Forge must not become slow over time. The prior platform (Traqly) degraded due to specific architectural choices that this build avoids:

1. **No Prisma.** Prisma's connection pool churn on serverless functions adds 200–800ms to cold starts. Use Supabase's pgbouncer-backed direct connections instead.
2. **No NextAuth.** Session lookup on every protected route is an unnecessary database round-trip. Supabase Auth's JWT verification is local and fast.
3. **No client-side data fetching for cacheable reads.** The leaderboard is read by hundreds of users per minute; it must be ISR-rendered, not fetched per-client.
4. **Server Components by default.** Send HTML, not JSON-plus-JS-that-builds-HTML.
5. **No `useEffect` for data loading.** Server Components or Server Actions.
6. **Image uploads bypass the Next.js server.** Direct browser → Supabase Storage via signed URL.
7. **Single round-trip queries.** The leaderboard query returns everything the page needs in one call.
8. **Database connection limits respected.** Use Supabase's connection pooler (port 6543) for serverless, not the direct port (5432).
9. **No N+1.** Every query is verified by reviewing the generated SQL.

---

## 18. Build Order — What Ships in Phase 1

Phase 1 must ship before Day 1 of Exam Flame (June 17). Build in this order:

1. **Bootstrap:** Next.js 15 + TypeScript + Tailwind v4. Supabase project. Environment variables.
2. **Schema:** Run the migrations in §8. Seed halls. Seed the Exam Flame challenge as `draft`. Seed the first superadmin.
3. **Auth:** Email OTP flow. `/auth`, `/auth/verify`, `/welcome`. Middleware.
4. **Challenge join:** `/exam-flame` page. Rules acceptance. Insert into `challenge_participants`.
5. **Leaderboard:** `/leaderboard` page with the full visual treatment. The `get_leaderboard()` function. ISR with `revalidate: 30`.
6. **Submission:** `/submit` page. Signed-URL upload. pHash duplicate check. Submission insert.
7. **Personal dashboard:** `/you` page with hero number, rivalry block, campaign strip, submission list.
8. **Admin queue:** `/admin` page. Confirm / Reject / Skip flow. Audit logging.
9. **Disqualification path** in the admin surface.
10. **Empty / loading / error states** across every page.
11. **PWA manifest, OG image, basic analytics events.**
12. **Polish pass:** read every screen on a 390px viewport; fix any spacing, contrast, or interaction issues.
13. **Flip the challenge from `draft` to `active`** at the launch moment.

**Phase 1.5 — during the 20 days, if time allows:**
- Tesseract.js OCR for stopwatch screenshots.
- Multiple admins via role assignment.
- Appeals flow.
- Leaderboard snapshot cron for accurate deltas.

**Phase 2 — post-event:**
- Google OAuth.
- Forge handles (@username).
- Hall vs. hall competition mode.
- SuperAdmin console.
- Multi-challenge surface in the UI.
- Public participant profiles.
- Push notifications.

---

## 19. Anti-Improvisation Rules

Claude Code, when in doubt about any of the following, **do not improvise — do the safer thing**:

1. **Color values.** Only the colors in §5.1 exist. Do not introduce a "slightly different amber" or a "subtle blue accent."
2. **Font weights.** Only 400 and 500. Never 600 or 700.
3. **Border-radius.** Only `rounded-md` (6px) or `rounded-none`. Never `rounded-lg`, `rounded-xl`, `rounded-2xl`.
4. **Shadows.** None.
5. **Animation durations.** 150ms ease-out. Never 200ms, never 300ms, never spring physics.
6. **Icons.** Use the small set listed in §7. Do not import a 200-icon library.
7. **Library additions.** If a problem can be solved with the existing stack, do not add a library. Adding a library requires explicit justification in a comment.
8. **New routes.** Only the routes listed in §13 and §16 in V1. Do not invent a `/settings` page, a `/help` page, or a `/about` page.
9. **Toasts and modals.** Use page-level responses for important state. Modals only for destructive confirmations (e.g., "disqualify this participant?").
10. **Mock data.** Seed data must be realistic — real hall names, real course names. Never `"Test User 1"`.

---

## 20. Final Directive

Forge is not a SaaS app. It is a competitive platform whose visual restraint is its strongest claim to seriousness. Every screen must feel like it was built by someone who cared about the difference between 14px and 13px, between `#71717A` and `#52525B`, between "the cut" and "PRIZE LINE". The user must feel that, even if they cannot articulate it.

You are not optimizing for speed of implementation. You are optimizing for the perception that Forge was handcrafted — that it could only have come from this team, for this event, with this set of constraints. The strongest version of this product is the one where someone screenshots the leaderboard, sends it to a friend, and the friend asks "what app is that?" — because the design is unmistakable.

When you finish a screen, ask:

- Does this answer one of the five questions in §2?
- Does this feel handcrafted, or templated?
- Could this only belong to Forge, or could it belong to any well-designed dashboard?
- Is the amber budget respected?
- Does this render correctly on 390px?

If any answer is wrong, rebuild before moving on.

The challenge starts on 17 June 2026 at 00:00 Africa/Lagos. Hundreds of people will be watching this leaderboard for twenty days. The design must hold up under that scrutiny.

Build.

— End of Master Build Prompt
