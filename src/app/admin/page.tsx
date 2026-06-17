import { requireAdmin, getActiveChallenge } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminQueue, type QueueItem } from "./admin-queue";

export const dynamic = "force-dynamic";

interface SubRow {
  id: string;
  participant_id: string;
  challenge_day: number;
  hours_claimed: number;
  ocr_extracted_hours: number | null;
  topic: string;
  whatsapp_post_time: string | null;
  submitted_at: string;
  flag_reasons: string[];
  internal_notes: string | null;
  screenshot_path: string;
  profiles: { full_name: string; course: string; hall_id: string | null } | null;
}

export default async function AdminPage() {
  await requireAdmin();
  const challenge = await getActiveChallenge();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: pending } = await supabase
    .from("submissions")
    .select(
      "id, participant_id, challenge_day, hours_claimed, ocr_extracted_hours, topic, whatsapp_post_time, submitted_at, flag_reasons, internal_notes, screenshot_path, profiles(full_name, course, hall_id)"
    )
    .eq("challenge_id", challenge.id)
    .eq("status", "pending")
    .order("submitted_at", { ascending: false });

  const rows = (pending ?? []) as unknown as SubRow[];

  // Halls + per-participant history, fetched once.
  const hallIds = [...new Set(rows.map((r) => r.profiles?.hall_id).filter(Boolean) as string[])];
  const participantIds = [...new Set(rows.map((r) => r.participant_id))];

  const [{ data: halls }, { data: history }] = await Promise.all([
    hallIds.length
      ? supabase.from("halls").select("id, name").in("id", hallIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    participantIds.length
      ? supabase
          .from("submissions")
          .select("participant_id, status")
          .eq("challenge_id", challenge.id)
          .in("participant_id", participantIds)
      : Promise.resolve({ data: [] as { participant_id: string; status: string }[] }),
  ]);

  const hallName = new Map((halls ?? []).map((h) => [h.id, h.name]));
  const hist = new Map<string, { confirmed: number; rejected: number; pending: number }>();
  for (const h of history ?? []) {
    const cur = hist.get(h.participant_id) ?? { confirmed: 0, rejected: 0, pending: 0 };
    cur[h.status as "confirmed" | "rejected" | "pending"]++;
    hist.set(h.participant_id, cur);
  }

  // Signed URLs for each screenshot (1h). §16
  const items: QueueItem[] = await Promise.all(
    rows.map(async (r) => {
      const { data: signed } = await admin.storage
        .from("submissions")
        .createSignedUrl(r.screenshot_path, 3600);
      return {
        id: r.id,
        participantId: r.participant_id,
        fullName: r.profiles?.full_name ?? "Unknown",
        course: r.profiles?.course ?? "",
        hall: r.profiles?.hall_id ? (hallName.get(r.profiles.hall_id) ?? null) : null,
        day: r.challenge_day,
        hoursClaimed: Number(r.hours_claimed),
        ocrHours: r.ocr_extracted_hours != null ? Number(r.ocr_extracted_hours) : null,
        topic: r.topic,
        whatsappTime: r.whatsapp_post_time,
        submittedAt: r.submitted_at,
        flags: r.flag_reasons ?? [],
        internalNotes: r.internal_notes,
        screenshotUrl: signed?.signedUrl ?? null,
        history: hist.get(r.participant_id) ?? { confirmed: 0, rejected: 0, pending: 0 },
      };
    })
  );

  // Flagged pinned to top, then newest first (already sorted by submitted_at).
  items.sort((a, b) => Number(b.flags.length > 0) - Number(a.flags.length > 0));

  return <AdminQueue items={items} challengeId={challenge.id} />;
}
