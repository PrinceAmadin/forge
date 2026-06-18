import { notFound } from "next/navigation";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Eyebrow, Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { formatHM } from "@/lib/time/format";
import { ResolveButtons } from "./resolve-buttons";

export const dynamic = "force-dynamic";

export default async function AppealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: appeal } = await supabase
    .from("appeals")
    .select("id, status, participant_explanation, additional_evidence_path, submission_id")
    .eq("id", id)
    .maybeSingle();
  if (!appeal) notFound();

  const { data: sub } = await supabase
    .from("submissions")
    .select("challenge_day, hours_claimed, rejection_reason, screenshot_path, participant_id")
    .eq("id", appeal.submission_id)
    .maybeSingle();
  if (!sub) notFound();

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", sub.participant_id)
    .maybeSingle();

  async function sign(path: string | null) {
    if (!path) return null;
    const { data } = await admin.storage.from("submissions").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }
  const [shotUrl, evidenceUrl] = await Promise.all([
    sign(sub.screenshot_path),
    sign(appeal.additional_evidence_path),
  ]);

  return (
    <>
      <PageHeader title={`Appeal · day ${sub.challenge_day}`} backHref="/admin/appeals" />
      <Page className="pt-8">
      <div className="max-w-[560px]">
        <div>
          <h2 className="font-serif text-[24px] leading-none text-primary">
            {prof?.full_name ?? "Unknown"}
          </h2>
          <p className="mt-2 font-mono text-[12px] text-tertiary">
            claimed {formatHM(sub.hours_claimed, "long")} · appeal {appeal.status}
          </p>
        </div>

        <section className="mt-8">
          <Eyebrow>original submission</Eyebrow>
          {sub.rejection_reason && <p className="mt-3 text-[14px] text-rejected">{sub.rejection_reason}</p>}
          {shotUrl && (
            <div className="mt-3 overflow-hidden rounded-md border border-[#27272a]">
              <Image src={shotUrl} alt="Original screenshot" width={560} height={400} className="h-auto w-full object-contain" unoptimized />
            </div>
          )}
        </section>

        <section className="mt-8">
          <Eyebrow>the appeal</Eyebrow>
          <p className="mt-3 whitespace-pre-wrap text-[14px] text-secondary">{appeal.participant_explanation}</p>
          {evidenceUrl && (
            <div className="mt-3 overflow-hidden rounded-md border border-[#27272a]">
              <Image src={evidenceUrl} alt="Appeal evidence" width={560} height={400} className="h-auto w-full object-contain" unoptimized />
            </div>
          )}
        </section>

        {appeal.status === "pending" ? (
          <ResolveButtons appealId={appeal.id} />
        ) : (
          <p className="mt-8 font-serif text-[16px] italic text-tertiary">
            Resolved — {appeal.status}.
          </p>
        )}
      </div>
      </Page>
    </>
  );
}
