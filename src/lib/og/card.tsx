import { createClient } from "@supabase/supabase-js";
import { toRoman, toRomanUpper } from "@/lib/format";
import { formatHM } from "@/lib/time/format";

// The social card, shared by the platform image at /opengraph-image and the
// per-challenge image at /c/[slug]/opengraph-image.
//
// This matters more than it looks: challenges are shared into WhatsApp groups,
// so the preview card IS the acquisition surface. Before the routes moved, one
// hardcoded card served everything — meaning a link to any new challenge would
// have previewed as The Exam Flame.
//
// Everything here stays fetch-only so it can run on the edge runtime, where
// @vercel/og loads its font assets via fetch rather than the Node resolver
// that fails under `next dev` on Windows.

export const OG_SIZE = { width: 1200, height: 630 };

export interface PodiumRow {
  name: string;
  hours: number;
  label: string;
}

export interface CardData {
  title: string;
  dayLine: string;
  podium: PodiumRow[];
  tagline: string;
}

const TAGLINE = "Where readers go to war.";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// A specific challenge's card: name, how far through it is, and its podium.
export async function challengeCardData(slug: string): Promise<CardData> {
  const fallback: CardData = { title: "Forge", dayLine: "", podium: [], tagline: TAGLINE };
  try {
    const supabase = serviceClient();
    if (!supabase) return fallback;

    const { data: challenge } = await supabase
      .from("challenges")
      .select("id, name, start_date, duration_days, status")
      .eq("slug", slug)
      .maybeSingle();
    if (!challenge) return fallback;

    // A draft has nothing to show and should not be previewable at all.
    if (challenge.status === "draft") {
      return { title: challenge.name, dayLine: "", podium: [], tagline: TAGLINE };
    }

    const start = Date.parse(`${challenge.start_date}T00:00:00Z`);
    const elapsed = Math.floor((Date.now() - start) / 86_400_000) + 1;
    const day = Math.max(0, Math.min(elapsed, challenge.duration_days));

    const { data: rows } = await supabase.rpc("get_leaderboard", {
      p_challenge_id: challenge.id,
    });

    return {
      title: challenge.name,
      dayLine: `${toRoman(day)} ╱ ${toRoman(challenge.duration_days)}`,
      podium: (rows ?? [])
        .slice(0, 3)
        .map((r: { full_name: string; total_hours: number; rank: number }) => ({
          name: r.full_name,
          hours: Number(r.total_hours),
          label: toRomanUpper(r.rank),
        })),
      tagline: TAGLINE,
    };
  } catch {
    return fallback;
  }
}

// The platform card, for the bare domain. Deliberately NOT one challenge's
// podium: with several challenges running, picking one would be arbitrary and
// would go stale the moment it ended.
export async function platformCardData(): Promise<CardData> {
  try {
    const supabase = serviceClient();
    if (!supabase) return { title: "Forge", dayLine: "", podium: [], tagline: TAGLINE };

    const { count } = await supabase
      .from("challenges")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    return {
      title: "Forge",
      dayLine: count && count > 0 ? `${count} live ${count === 1 ? "challenge" : "challenges"}` : "",
      podium: [],
      tagline: TAGLINE,
    };
  } catch {
    return { title: "Forge", dayLine: "", podium: [], tagline: TAGLINE };
  }
}

export function OgCard({ data }: { data: CardData }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0A0A0B",
        padding: "64px 72px",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{ fontSize: 22, letterSpacing: 6, color: "#71717A", textTransform: "lowercase" }}
        >
          forge
        </div>
        <div style={{ fontSize: 84, color: "#FAFAFA", marginTop: 8 }}>{data.title}</div>
        {data.dayLine && (
          <div style={{ fontSize: 30, color: "#F59E0B", fontStyle: "italic", marginTop: 8 }}>
            {data.dayLine}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {data.podium.length > 0 ? (
          data.podium.map((p) => (
            <div key={p.label} style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
              <span style={{ fontSize: 44, fontStyle: "italic", color: "#F59E0B", width: 80 }}>
                {p.label}
              </span>
              <span style={{ fontSize: 40, color: "#FAFAFA", flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 38, color: "#A1A1AA", fontFamily: "monospace" }}>
                {formatHM(p.hours, "compact")}
              </span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 34, color: "#A1A1AA" }}>{data.tagline}</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <span style={{ fontSize: 24, fontStyle: "italic", color: "#F59E0B" }}>the cut</span>
        <span style={{ flex: 1, height: 1, backgroundColor: "#27272A" }} />
      </div>
    </div>
  );
}

// @vercel/og can fail to resolve its bundled font on some Node/OS combinations.
// Never reset the connection — hand crawlers a valid SVG instead.
export function ogSvgFallback(title: string, tagline = TAGLINE): Response {
  const esc = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${OG_SIZE.height}">
  <rect width="100%" height="100%" fill="#0A0A0B"/>
  <text x="72" y="300" font-family="Georgia, serif" font-size="84" fill="#FAFAFA">${esc(title)}</text>
  <text x="72" y="360" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#A1A1AA">${esc(tagline)}</text>
</svg>`;
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
  });
}
