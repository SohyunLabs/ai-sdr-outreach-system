import { Suspense } from "react";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";
import { getDashboardData, getProfileAnalysisData } from "@/lib/dashboard-data";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

// Force dynamic rendering — page fetches live DB data on every request
export const dynamic = "force-dynamic";

export default async function Home() {
  const [
    session,
    { campaigns, lastSyncAt },
    { contacts, unmatchedLeads, lastSyncAt: profileLastSyncAt },
  ] = await Promise.all([auth(), getDashboardData(), getProfileAnalysisData()]);

  const userRole = session?.user?.role ?? null;

  const kbContent = fs.readFileSync(
    path.join(process.cwd(), "content", "knowledge-base.md"),
    "utf-8"
  );

  return (
    <Suspense>
      <DashboardShell
        campaigns={campaigns}
        lastSyncAt={lastSyncAt}
        contacts={contacts}
        unmatchedLeads={unmatchedLeads}
        profileLastSyncAt={profileLastSyncAt}
        kbContent={kbContent}
        userRole={userRole}
      />
    </Suspense>
  );
}
