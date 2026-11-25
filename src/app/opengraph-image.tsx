import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, ogSvgFallback, platformCardData } from "@/lib/og/card";

// Edge runtime: @vercel/og loads its WASM/font assets via fetch here, which
// avoids the Node fileURLToPath resolver that fails under `next dev` on Windows.
// Supabase-js talks over fetch, so it works on edge too.
export const runtime = "edge";
export const alt = "Forge — where readers go to war";
export const size = OG_SIZE;
export const contentType = "image/png";

// The platform card, for the bare domain. A specific challenge gets its own at
// /c/[slug]/opengraph-image — this used to be hardcoded to the exam-flame slug,
// which meant every shared link previewed as that one challenge.
export default async function Og() {
  const data = await platformCardData();
  try {
    return new ImageResponse(<OgCard data={data} />, size);
  } catch {
    return ogSvgFallback(data.title);
  }
}
