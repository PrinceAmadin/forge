export const DEFAULT_NEXT = "/leaderboard";

// Validate a ?next= destination before redirecting to it.
//
// An unchecked `next` is an open redirect: a crafted link carries someone
// through Forge's sign-in and deposits them on another site with a session
// freshly established, which is the classic phishing shape.
//
// The rule is "a path on this origin, and nothing else". Every internal route
// is already access-controlled server-side, so the thing worth preventing is
// leaving the origin — not reaching a particular page. That also means admins
// keep working deep links (/admin/challenges/new), which a route allowlist
// would have silently redirected away from.
//
// Rejected, and why:
//   https://evil.example   absolute URL, another origin
//   //evil.example         protocol-relative — the browser supplies the scheme
//   /\evil.example         browsers normalise backslashes to slashes
//   /a/../../b             traversal; nothing legitimate needs it
//   javascript:…           not a path at all
export function safeNext(next: string | null | undefined, fallback = DEFAULT_NEXT): string {
  const value = (next ?? "").trim();
  if (!value) return fallback;

  // Must be a root-relative path, and only one leading slash.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;

  // Backslashes, control characters and whitespace are all ways to confuse
  // either the browser's URL parser or a human reading the link.
  if (/[\\\s]/.test(value)) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  if (value.includes("..")) return fallback;

  // A conservative character set for path + query + fragment.
  if (!/^\/[A-Za-z0-9\-._~/%?=&:@+,;!$'()*[\]#]*$/.test(value)) return fallback;

  return value;
}
