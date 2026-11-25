import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard, challengeCardData, ogSvgFallback } from "@/lib/og/card";

export const runtime = "edge";
export const alt = "A Forge challenge";
export const size = OG_SIZE;
export const contentType = "image/png";

// The card people actually see. Challenge links get shared into WhatsApp
// groups, so this preview is the acquisition surface — it has to show the
// challenge being shared, not whichever one happened to be hardcoded.
export default async function ChallengeOg({ params }: { params: { slug: string } }) {
  const data = await challengeCardData(params.slug);
  try {
    return new ImageResponse(<OgCard data={data} />, size);
  } catch {
    return ogSvgFallback(data.title);
  }
}
