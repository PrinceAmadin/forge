import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { resolvePrimaryChallenge } from "@/lib/challenges";
import { CHALLENGE_COOKIE } from "@/lib/challenge-cookie";

export const dynamic = "force-dynamic";

// Back-compat stub. These paths predate challenge-scoped routing and are in
// people's bookmarks, in WhatsApp messages, and in the PWA manifest's
// start_url, so they must never 404.
//
// This cannot live in middleware: resolving which challenge someone should land
// on needs a database read.

export default async function LeaderboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) redirect("/auth?next=/leaderboard");

  const preferred = (await cookies()).get(CHALLENGE_COOKIE)?.value ?? null;
  const challenge = await resolvePrimaryChallenge(user.id, preferred);

  // Enrolled in nothing (or only in archived challenges) → go and find one.
  if (!challenge) redirect("/challenges");
  // Carry the query string through, or a confirmation like
  // ?appealed=1 is silently lost on the way.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const query = qs.toString();
  redirect(`/c/${challenge.slug}/leaderboard${query ? `?${query}` : ""}`);
}
