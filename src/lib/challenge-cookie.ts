// Remembers which challenge a participant was last looking at, so the
// pre-routing paths (/leaderboard, /submit, /you) send them back there instead
// of guessing. Set by middleware on any /c/:slug request — no database read.
//
// It is a convenience only: resolvePrimaryChallenge ignores it unless it still
// names a live enrolment, so a stale or forged value cannot grant access to
// anything.
export const CHALLENGE_COOKIE = "forge_c";
