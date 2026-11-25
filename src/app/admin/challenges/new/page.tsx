import { requireSuperAdmin } from "@/lib/auth";
import { Page } from "@/components/ui";
import { PageHeader } from "@/components/nav/page-header";
import { ChallengeForm } from "./challenge-form";

export const dynamic = "force-dynamic";

export default async function NewChallengePage() {
  await requireSuperAdmin();

  return (
    <>
      <PageHeader title="New challenge" backHref="/admin/challenges" />
      <Page className="pt-8">
        <div className="max-w-[560px] pb-28 sm:pb-12">
          <ChallengeForm />
        </div>
      </Page>
    </>
  );
}
