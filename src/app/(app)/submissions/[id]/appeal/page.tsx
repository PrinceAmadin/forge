import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { AppealForm } from "./appeal-form";

export const dynamic = "force-dynamic";

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/auth");
  const supabase = await createClient();

  const { data: sub } = await supabase
    .from("submissions")
    .select("id, participant_id, challenge_day, status, rejection_reason")
    .eq("id", id)
    .maybeSingle();
  if (!sub || sub.participant_id !== user.id) notFound();
  if (sub.status !== "rejected") redirect(`/submissions/${id}`);

  const { data: existing } = await supabase
    .from("appeals")
    .select("id")
    .eq("submission_id", id)
    .maybeSingle();
  if (existing) redirect(`/submissions/${id}`);

  return (
    <Page className="pt-10">
      <div className="max-w-[480px]">
        <BackButton href={`/submissions/${id}`} />
        <div className="mt-3">
          <Eyebrow>appeal</Eyebrow>
          <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">Appeal day {sub.challenge_day}</h1>
        </div>

        {sub.rejection_reason && (
          <blockquote className="mt-6 border-l-2 border-[#3f3f46] pl-4 text-[14px] italic text-tertiary">
            {sub.rejection_reason}
          </blockquote>
        )}

        <AppealForm submissionId={id} userId={user.id} />
      </div>
    </Page>
  );
}
