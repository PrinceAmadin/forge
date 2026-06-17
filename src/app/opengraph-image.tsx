import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { toRoman, toRomanUpper, fmtHours } from "@/lib/format";

// Edge runtime: @vercel/og loads its WASM/font assets via fetch here, which
// avoids the Node fileURLToPath resolver that fails under `next dev` on Windows.
// Supabase-js talks over fetch, so it works on edge too.
export const runtime = "edge";
export const alt = "The Exam Flame — Forge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Top3 {
  name: string;
  hours: number;
  label: string;
}

export default async function Og() {
  let title = "The Exam Flame";
  let dayLine = "";
  let podium: Top3[] = [];

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const { data: challenge } = await supabase
        .from("challenges")
        .select("id, name, start_date, duration_days")
        .eq("slug", "exam-flame")
        .single();
      if (challenge) {
        title = challenge.name;
        const start = Date.parse(`${challenge.start_date}T00:00:00Z`);
        const elapsed = Math.floor((Date.now() - start) / 86_400_000) + 1;
        const day = Math.max(0, Math.min(elapsed, challenge.duration_days));
        dayLine = `${toRoman(day)} ╱ ${toRoman(challenge.duration_days)}`;
        const { data: rows } = await supabase.rpc("get_leaderboard", { p_challenge_id: challenge.id });
        podium = (rows ?? []).slice(0, 3).map((r: { full_name: string; total_hours: number; rank: number }) => ({
          name: r.full_name,
          hours: Number(r.total_hours),
          label: toRomanUpper(r.rank),
        }));
      }
    }
  } catch {
    // Fall back to brand-only card.
  }

  try {
    return new ImageResponse(
    (
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
          <div style={{ fontSize: 22, letterSpacing: 6, color: "#71717A", textTransform: "lowercase" }}>
            forge
          </div>
          <div style={{ fontSize: 84, color: "#FAFAFA", marginTop: 8 }}>{title}</div>
          {dayLine && (
            <div style={{ fontSize: 30, color: "#F59E0B", fontStyle: "italic", marginTop: 8 }}>{dayLine}</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {podium.length > 0 ? (
            podium.map((p) => (
              <div key={p.label} style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
                <span style={{ fontSize: 44, fontStyle: "italic", color: "#F59E0B", width: 80 }}>{p.label}</span>
                <span style={{ fontSize: 40, color: "#FAFAFA", flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 38, color: "#A1A1AA", fontFamily: "monospace" }}>{fmtHours(p.hours)}h</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 34, color: "#A1A1AA" }}>Where readers go to war.</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 24, fontStyle: "italic", color: "#F59E0B" }}>the cut</span>
          <span style={{ flex: 1, height: 1, backgroundColor: "#27272A" }} />
        </div>
      </div>
    ),
    size
    );
  } catch {
    // @vercel/og can fail to resolve its bundled font on some Node/OS combos.
    // Never reset the connection — hand crawlers a valid SVG fallback instead.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">
      <rect width="100%" height="100%" fill="#0A0A0B"/>
      <text x="72" y="300" font-family="Georgia, serif" font-size="84" fill="#FAFAFA">${title}</text>
      <text x="72" y="360" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#A1A1AA">Where readers go to war.</text>
    </svg>`;
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600" },
    });
  }
}
