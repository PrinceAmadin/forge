// Validate a ?next= destination before redirecting to it.
//
// An unchecked `next` is an open-redirect: a crafted link could bounce someone
// through the sign-in flow and out to another site with their session freshly
// established. Only same-site paths that belong to the join funnel are allowed.
const ALLOWED = [
  /^\/c\/[a-z0-9]+(-[a-z0-9]+)*$/, // a challenge landing page
  /^\/c\/[a-z0-9]+(-[a-z0-9]+)*\/(leaderboard|submit|you)$/,
  /^\/challenges$/,
  /^\/leaderboard$/,
];

export const DEFAULT_NEXT = "/leaderboard";

export function safeNext(next: string | null | undefined): string {
  const value = (next ?? "").trim();
  if (!value) return DEFAULT_NEXT;
  // Reject protocol-relative ("//evil.com") and absolute URLs outright.
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_NEXT;
  return ALLOWED.some((re) => re.test(value)) ? value : DEFAULT_NEXT;
}
