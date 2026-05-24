import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getLeadProfile, getPendingLeadProfile, getLastSync } from "@/lib/lead-data";
import { LeadProfileShell } from "@/components/dashboard/lead-profile-shell";

export const dynamic = "force-dynamic";

export default async function LeadProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pending?: string; campaignId?: string }>;
}) {
  const { id } = await params;
  const { pending, campaignId } = await searchParams;

  const isPending = pending === "1" && !!campaignId;

  const [session, profile, lastSyncAt] = await Promise.all([
    auth(),
    isPending ? getPendingLeadProfile(id, campaignId!) : getLeadProfile(id),
    getLastSync(),
  ]);
  const userRole = session?.user?.role ?? null;

  if (!profile) notFound();

  return (
    <LeadProfileShell
      profile={profile}
      lastSyncAt={lastSyncAt}
      mode={isPending ? "pending" : undefined}
      pendingCampaignId={isPending ? campaignId : undefined}
      userRole={userRole}
    />
  );
}
