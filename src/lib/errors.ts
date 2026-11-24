// Coerce any thrown/returned error shape into a useful string.
//
// Supabase/Postgres errors are plain objects ({ message, code, details, hint })
// with no `Error` prototype, so they stringify to "{}" when rendered as a React
// child — that was the silent empty-error bug behind §admin-delete. Anything
// shown to a user goes through here.
//
// Lifted from admin/users/actions.ts, which had the fuller version; the copy in
// settings/profile/actions.ts differed only in its fallback string, hence the
// required `fallback` argument.
export function describeError(e: unknown, fallback: string): string {
  if (e && typeof e === "object") {
    const err = e as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    if (typeof err.message === "string" && err.message.trim()) return err.message;
    if (err.code != null && String(err.code).trim()) {
      const details =
        typeof err.details === "string" && err.details.trim()
          ? err.details
          : typeof err.hint === "string" && err.hint.trim()
            ? err.hint
            : "see server logs";
      return `Database error [${String(err.code)}]: ${details}`;
    }
  }
  if (typeof e === "string" && e.trim()) return e;
  return fallback;
}
