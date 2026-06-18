import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { timeAgo } from "@/lib/format";
import { formatHM } from "@/lib/time/format";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/auth");
  const supabase = await createClient();

  // RLS restricts reads to the owner (or admins) — owners only see their own.
  const { data: sub } = await supabase
    .from("submissions")
    .select("id, participant_id, challenge_day, hours_claimed, hours_credited, topic, status, submitted_at, rejection_reason, screenshot_path")
    .eq("id", id)
    .maybeSingle();
  if (!sub || sub.participant_id !== user.id) notFound();

  const { data: appeal } = await supabase
    .from("appeals")
    .select("status")
    .eq("submission_id", id)
    .maybeSingle();

  let screenshotUrl: string | null = null;
  if (sub.screenshot_path) {
    const { data: signed } = await supabase.storage
      .from("submissions")
      .createSignedUrl(sub.screenshot_path, 3600);
    screenshotUrl = signed?.signedUrl ?? null;
  }

  const isManual = sub.topic.startsWith("Manual entry");

  return (
    <Page className="pt-10">
      <div className="max-w-[480px]">
        <BackButton href="/you" />
        <div className="mt-3">
          <Eyebrow>day {sub.challenge_day}</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] italic leading-none text-primary">
            {formatHM(sub.hours_credited ?? sub.hours_claimed, "long")}
          </h1>
          <p className="mt-2 font-mono text-[12px] text-tertiary">
            {sub.status} · {timeAgo(sub.submitted_at)}
          </p>
        </div>

        <p className={`mt-6 text-[14px] ${isManual ? "italic text-tertiary" : "text-secondary"}`}>
          {isManual ? "Manual entry" : sub.topic}
        </p>

        {screenshotUrl && (
          <div className="mt-5 overflow-hidden rounded-md border border-[#27272a]">
            <Image
              src={screenshotUrl}
              alt={`Day ${sub.challenge_day} screenshot`}
              width={480}
              height={360}
              className="h-auto w-full object-contain"
              unoptimized
            />
          </div>
        )}

        {sub.status === "rejected" && (
          <div className="mt-6">
            {sub.rejection_reason && (
              <p className="text-[14px] text-rejected">{sub.rejection_reason}</p>
            )}
            {appeal ? (
              <p className="mt-3 font-serif text-[14px] italic text-tertiary">
                Appeal {appeal.status === "pending" ? "submitted — awaiting review" : appeal.status}.
              </p>
            ) : (
              <Link
                href={`/submissions/${id}/appeal`}
                className="mt-3 inline-block font-serif text-[14px] italic text-accent"
              >
                Appeal this rejection →
              </Link>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
