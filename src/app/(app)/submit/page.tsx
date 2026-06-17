import Link from "next/link";
import { requireOnboardedViewer, getActiveChallenge, getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { submittableDay, formatLagosDate } from "@/lib/challenge";
import { toRoman } from "@/lib/format";
import { Eyebrow, PrimaryButton } from "@/components/ui";
import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  await requireOnboardedViewer();
  const [challenge, user] = await Promise.all([getActiveChallenge(), getUser()]);
  const day = submittableDay(challenge);

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto w-full max-w-[480px] px-5 pb-28 pt-10 sm:px-7">{children}</div>
  );

  if (challenge.status !== "active") {
    return shell(
      <div className="flex flex-col gap-4">
        <Eyebrow>submit</Eyebrow>
        <p className="font-serif text-[28px] italic text-primary">Not open yet.</p>
        <p className="text-[14px] text-secondary">
          The Exam Flame begins {challenge.start_date}. Come back when the first day opens.
        </p>
      </div>
    );
  }

  if (day == null) {
    return shell(
      <div className="flex flex-col gap-4">
        <Eyebrow>submit</Eyebrow>
        <p className="font-serif text-[28px] italic text-primary">The campaign is over.</p>
        <Link href="/leaderboard">
          <PrimaryButton className="h-[52px]">View the final standings</PrimaryButton>
        </Link>
      </div>
    );
  }

  // Already submitted for the open day?
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("submissions")
    .select("status, hours_claimed")
    .eq("challenge_id", challenge.id)
    .eq("participant_id", user!.id)
    .eq("challenge_day", day)
    .maybeSingle();

  if (existing) {
    return shell(
      <div className="flex flex-col gap-4">
        <Eyebrow>submit</Eyebrow>
        <p className="font-serif text-[36px] leading-none text-primary">Day {day}</p>
        <p className="text-[14px] text-secondary">
          You&rsquo;ve logged today — {existing.hours_claimed} hours,{" "}
          {existing.status === "pending"
            ? "awaiting verification"
            : existing.status === "confirmed"
              ? "confirmed"
              : "rejected"}
          .
        </p>
        <Link href="/leaderboard">
          <PrimaryButton className="h-[52px]">View leaderboard</PrimaryButton>
        </Link>
      </div>
    );
  }

  return shell(
    <>
      <Eyebrow>submit</Eyebrow>
      <h1 className="mt-2 font-serif text-[36px] leading-none text-primary">
        Day {day} <span className="text-[#52525b]">· {toRoman(day)}</span>
      </h1>
      <p className="mt-2 text-[13px] text-tertiary">{formatLagosDate(challenge)}</p>
      <div className="mt-8">
        <SubmitForm day={day} userId={user!.id} />
      </div>
    </>
  );
}
