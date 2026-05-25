"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import { Sidebar, type SidebarPage } from "@/components/dashboard/sidebar";
import { Header } from "@/components/layout/header";
import { CampaignSelect } from "@/components/dashboard/campaign-select";
import { SyncButton } from "@/components/dashboard/sync-button";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CombinedLeadTable } from "@/components/dashboard/combined-lead-table";
import { GuidePage } from "@/components/dashboard/guide-page";
import { KnowledgeBasePage } from "@/components/dashboard/knowledge-base-page";
import { ProfileAnalysisView } from "@/components/dashboard/profile-analysis-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeSummary } from "@/lib/dashboard-utils";
import type { CampaignWithLeads, CampaignLeadWithContact, ContactWithLeads, UnmatchedLead } from "@/lib/dashboard-utils";

interface DashboardShellProps {
  campaigns: CampaignWithLeads[];
  lastSyncAt: Date | null;
  contacts: ContactWithLeads[];
  unmatchedLeads: UnmatchedLead[];
  profileLastSyncAt: Date | null;
  kbContent: string;
  userRole: string | null;
}


export function DashboardShell({ campaigns, lastSyncAt, contacts, unmatchedLeads, profileLastSyncAt, kbContent, userRole }: DashboardShellProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const campaignIdParam = searchParams.get("campaignId");
  const initialPage: SidebarPage =
    tabParam === "profile-analysis" || tabParam === "guide" || tabParam === "knowledge-base"
      ? tabParam
      : "campaign-analysis";
  const [activePage, setActivePage] = useState<SidebarPage>(initialPage);
  const initialCampaignId = (campaignIdParam && campaigns.some(c => c.id === campaignIdParam))
    ? campaignIdParam
    : (campaigns[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(initialCampaignId);
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingLeads, setPendingLeads] = useState<CampaignLeadWithContact[]>([]);
  const router = useRouter();

  // Sync URL with current tab/campaign state for page refresh persistence
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activePage);
    if (activePage === "campaign-analysis" && selectedId) {
      params.set("campaignId", selectedId);
    }
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }, [activePage, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    fetchPendingLeads(selectedId);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCampaign = campaigns.find((c) => c.id === selectedId);
  const leads = selectedCampaign?.leads ?? [];
  const baseSummary = computeSummary(leads);
  const summary = {
    ...baseSummary,
    total: baseSummary.total + pendingLeads.length,
    waiting: baseSummary.waiting + pendingLeads.length,
  };

  function handleCampaignSelect(id: string) {
    setSelectedId(id);
    setSelectedPendingIds(new Set());
  }

  async function fetchPendingLeads(id: string) {
    return fetch(`/api/campaigns/${id}/pending-leads`)
      .then((r) => r.json())
      .then((data) => setPendingLeads(Array.isArray(data) ? data : []))
      .catch(() => setPendingLeads([]));
  }

  async function handleSync() {
    if (userRole !== "Admin") {
      toast.error("Permission denied. Please sign in with an Admin account.");
      throw new Error("no-permission");
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error("sync failed");
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function handleLaunch() {
    const selected = pendingLeads.filter((l) => selectedPendingIds.has(l.id));
    if (selected.length === 0) return;

    setLaunching(true);
    toast.loading(`Launching ${selected.length} leads...`, { id: "launch", duration: Infinity });
    try {
      const results = await Promise.allSettled(
        selected.map((lead) =>
          fetch(
            `/api/campaigns/${lead.campaignId}/launch/${lead.airtableContactId}`,
            { method: "POST" }
          ).then((r) => r.json())
        )
      );

      const succeeded = results.filter(
        (r) => r.status === "fulfilled" && r.value?.ok
      ).length;
      const failed = results.length - succeeded;

      if (failed === 0) {
        toast.success(`${succeeded} leads launched successfully`, { id: "launch", duration: 3000 });
      } else if (succeeded === 0) {
        toast.error(`Launch failed (${failed})`, { id: "launch", duration: 3000 });
      } else {
        toast.warning(`${succeeded} succeeded, ${failed} failed`, { id: "launch", duration: 3000 });
      }

      if (succeeded > 0) {
        await fetch("/api/sync", { method: "POST" });
        router.refresh();
      }

      setSelectedPendingIds(new Set());
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {activePage === "guide" ? (
          <>
            <Header title="Guide" />
            <main className="flex-1 overflow-y-auto bg-muted/40">
              <div className="px-8 py-8">
                <GuidePage />
              </div>
            </main>
          </>
        ) : activePage === "knowledge-base" ? (
          <>
            <Header title="Knowledge Base" />
            <main className="flex-1 overflow-y-auto bg-muted/40">
              <div className="px-8 py-8">
                <KnowledgeBasePage content={kbContent} />
              </div>
            </main>
          </>
        ) : activePage === "profile-analysis" ? (
          <ProfileAnalysisView
            contacts={contacts}
            unmatchedLeads={unmatchedLeads}
            lastSyncAt={profileLastSyncAt}
          />
        ) : (
          <>
            <Header title="Campaign Analysis" />
            <main className="flex-1 overflow-y-auto bg-muted/40">
              <div className="px-8 py-8 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <CampaignSelect
                    campaigns={campaigns}
                    selectedId={selectedId}
                    onSelect={handleCampaignSelect}
                  />
                  <div className="flex items-start gap-0">
                    <Button
                      size="sm"
                      disabled={selectedPendingIds.size === 0 || launching}
                      onClick={handleLaunch}
                      className={cn("gap-1.5")}
                    >
                      <Rocket className={cn("h-3.5 w-3.5", launching && "animate-pulse")} />
                      {launching
                        ? "Launching…"
                        : selectedPendingIds.size > 0
                        ? `Lemlist Launch (${selectedPendingIds.size})`
                        : "Lemlist Launch"}
                    </Button>
                    <SyncButton
                      lastSyncAt={lastSyncAt}
                      onSync={handleSync}
                      syncing={syncing}
                    />
                  </div>
                </div>
                <SummaryCards summary={summary} />
                <CombinedLeadTable
                  launchedLeads={leads}
                  pendingLeads={pendingLeads}
                  selectedPendingIds={selectedPendingIds}
                  onPendingSelectionChange={setSelectedPendingIds}
                />
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
