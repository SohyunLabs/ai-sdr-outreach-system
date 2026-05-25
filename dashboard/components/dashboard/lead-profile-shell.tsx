"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar, type SidebarPage } from "@/components/dashboard/sidebar";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SequenceBar } from "@/components/dashboard/sequence-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Mail,
  ExternalLink,
  RefreshCw,
  Rocket,
  Settings,
  Linkedin,
} from "lucide-react";
import type { InboxItem } from "@/app/api/leads/[id]/lemlist-inbox/route";


import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  buildEmailSequence,
  buildLinkedinSequence,
  deriveCompletedActivities,
  getActivityMessageLabel,
  getBodyByLabel,
  ACTIVITY_META,
  groupActivitiesByDate,
  type FlowNode,
  type FlowStepData,
  type ActivityItem,
  type MessageForActivity,
} from "@/lib/lead-profile-utils";
import { formatSyncTimestamp } from "@/lib/dashboard-utils";
import { GREEN_STATES, RED_STATES } from "@/lib/status-colors";
import type { LeadProfileData } from "@/lib/lead-data";

interface LeadProfileShellProps {
  profile: LeadProfileData;
  lastSyncAt: Date | null;
  mode?: "pending";
  pendingCampaignId?: string;
  userRole: string | null;
}

const CONTENT_TYPES = new Set(["emailsSent", "linkedinSent", "linkedinInviteDone", "linkedinConnect"]);

function nameInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0]?.toUpperCase() ?? "?";
}

function ActivityHistoryCard({
  activities,
  contactName,
  assigneeName,
  message,
  showCampaignTag,
  hasEmail,
}: {
  activities: ActivityItem[];
  contactName?: string | null;
  assigneeName?: string | null;
  message?: MessageForActivity | null;
  showCampaignTag?: boolean;
  hasEmail?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on mount so the latest activity is visible
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const grouped = groupActivitiesByDate(activities); // ascending (oldest first)

  function toggleContent(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div ref={scrollRef} className="max-h-[420px] overflow-y-auto flex flex-col gap-5 pr-1">
          {grouped.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No activity records</p>
          ) : (
            grouped.map(({ date, items }) => (
              <div key={date}>
                {/* Date divider */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground/70 shrink-0">{date}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="flex flex-col gap-2">
                  {items.map((activity) => {
                    const meta = ACTIVITY_META[activity.type];
                    const isInbound = meta?.isInbound ?? false;
                    const isContentActivity = CONTENT_TYPES.has(activity.type);

                    const msgLabel = isContentActivity && activity.type !== "linkedinInviteDone"
                      ? getActivityMessageLabel(activity.id, activities, hasEmail ?? false)
                      : null;
                    const sentLookup = msgLabel ? getBodyByLabel(msgLabel, message ?? null, meta?.channel) : null;
                    const displayBody = isInbound
                      ? (activity.content ?? null)
                      : (sentLookup?.body ?? null);
                    const displaySubject = sentLookup?.subject ?? null;
                    // linkedinInviteDone is always status-only (shown without content)
                    const isStatusOnly = (!isInbound && !isContentActivity) ||
                      activity.type === "linkedinInviteDone";

                    const senderName = isInbound
                      ? (contactName ?? "Lead")
                      : (assigneeName ?? "Team");
                    const isExpanded = expandedIds.has(activity.id);
                    const time = new Date(activity.occurredAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    // ── Status-only event (e.g. emailOpened) ──
                    if (isStatusOnly) {
                      return (
                        <div key={activity.id} className="flex items-center gap-2 py-0.5 text-muted-foreground">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            meta?.channel === "email" ? "bg-blue-400" :
                            meta?.channel === "linkedin" ? "bg-blue-500" :
                            "bg-muted-foreground/40"
                          )} />
                          <span className="text-xs flex-1">{meta?.label ?? activity.type}</span>
                          {showCampaignTag && activity.campaignName && (
                            <span className="text-[10px] bg-muted rounded px-1">{activity.campaignName}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground/50 shrink-0">{time}</span>
                        </div>
                      );
                    }

                    // ── Content event (sent or inbound) ──
                    return (
                      <div key={activity.id} className={cn(
                        "rounded-lg border-l-2 px-3 py-2.5",
                        isInbound
                          ? "border-l-green-500 bg-green-50/60 dark:bg-green-950/20"
                          : "border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                      )}>
                        {/* Header row */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {/* Avatar */}
                          <span className={cn(
                            "inline-flex h-5 w-5 rounded-full items-center justify-center text-[10px] font-bold shrink-0",
                            isInbound ? "bg-muted text-muted-foreground" : "bg-blue-500 text-white"
                          )}>
                            {nameInitials(senderName)}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold",
                            isInbound ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"
                          )}>
                            {senderName}
                          </span>
                          {msgLabel && (
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{msgLabel}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground">· {meta?.label ?? activity.type}</span>
                          {showCampaignTag && activity.campaignName && (
                            <span className="text-[10px] bg-muted rounded px-1 text-muted-foreground ml-1">{activity.campaignName}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground/50 ml-auto shrink-0">{time}</span>
                        </div>

                        {/* Subject */}
                        {displaySubject && (
                          <p className="text-[11px] text-muted-foreground mb-1">
                            Subject: <span className="font-medium text-foreground/70">{displaySubject}</span>
                          </p>
                        )}

                        {/* Body */}
                        {displayBody ? (
                          <>
                            <p className={cn(
                              "text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed",
                              !isExpanded && "line-clamp-3"
                            )}>
                              {displayBody}
                            </p>
                            {displayBody.length > 180 && (
                              <button
                                className="text-[11px] text-muted-foreground hover:text-foreground mt-1.5 underline-offset-2 hover:underline"
                                onClick={() => toggleContent(activity.id)}
                              >
                                {isExpanded ? "Collapse" : "Show more"}
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic">No content</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]*>/g, "");
}

function LemlistInboxCard({
  leadId,
  contactName,
  assigneeName,
}: {
  leadId: string;
  contactName?: string | null;
  assigneeName?: string | null;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/lemlist-inbox`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading]);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Group items by date
  const grouped = items.reduce<{ date: string; items: InboxItem[] }[]>((acc, item) => {
    const dateKey = new Date(item.occurredAt).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });
    const last = acc[acc.length - 1];
    if (last?.date === dateKey) {
      last.items.push(item);
    } else {
      acc.push({ date: dateKey, items: [item] });
    }
    return acc;
  }, []);

  const META: Record<InboxItem["type"], { label: string; icon: "email" | "linkedin" | "system" }> = {
    "email-sent":       { label: "Email Sent", icon: "email" },
    "email-reply":      { label: "Email Reply Received", icon: "email" },
    "email-bounced":    { label: "Email Bounced", icon: "email" },
    "email-opened":     { label: "Email Opened", icon: "email" },
    "linkedin-connect": { label: "LinkedIn Invite Sent", icon: "linkedin" },
    "linkedin-message": { label: "LinkedIn Message Sent", icon: "linkedin" },
    "linkedin-opened":  { label: "LinkedIn Message Opened", icon: "linkedin" },
    "linkedin-reply":   { label: "LinkedIn Reply Received", icon: "linkedin" },
    "linkedin-accepted":{ label: "LinkedIn Invite Accepted", icon: "linkedin" },
    "linkedin-visit":   { label: "LinkedIn Visit", icon: "linkedin" },
  };

  const isStatusOnly = (item: InboxItem) => {
    const t = item.type;
    if (t === "email-opened" || t === "email-bounced" || t === "linkedin-opened" || t === "linkedin-visit" || t === "linkedin-accepted" || t === "linkedin-connect") return true;
    return false;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Send History (Inbox)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div ref={scrollRef} className="max-h-[500px] overflow-y-auto flex flex-col gap-5 pr-1">
          {loading ? (
            <div className="flex flex-col gap-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No send history</p>
          ) : (
            grouped.map(({ date, items: dayItems }) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground/70 shrink-0">{date}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="flex flex-col gap-2">
                  {dayItems.map((item) => {
                    const meta = META[item.type];
                    const time = new Date(item.occurredAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit", minute: "2-digit",
                    });
                    const bodyText = item.isHtml && item.body ? htmlToText(item.body) : (item.body ?? "");
                    const isExpanded = expandedIds.has(item.id);
                    const isInbound = item.isInbound;
                    const senderName = isInbound ? (contactName ?? "Lead") : (assigneeName ?? "Team");

                    // Status-only events
                    if (isStatusOnly(item)) {
                      const dotColor = item.type === "email-bounced"
                        ? "bg-red-400"
                        : item.type === "linkedin-accepted"
                        ? "bg-green-400"
                        : "bg-muted-foreground/40";
                      return (
                        <div key={item.id} className="flex items-center gap-2 py-0.5 text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
                          <span className="text-xs flex-1">{meta.label}</span>
                          <span className="text-[11px] text-muted-foreground/50 shrink-0">{time}</span>
                        </div>
                      );
                    }

                    // Content events (sent or inbound)
                    return (
                      <div key={item.id} className={cn(
                        "rounded-lg border-l-2 px-3 py-2.5",
                        isInbound
                          ? "border-l-green-500 bg-green-50/60 dark:bg-green-950/20"
                          : meta.icon === "linkedin"
                          ? "border-l-blue-600 bg-blue-50/40 dark:bg-blue-950/20"
                          : "border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                      )}>
                        {/* Header */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={cn(
                            "inline-flex h-5 w-5 rounded-full items-center justify-center text-[10px] font-bold shrink-0",
                            isInbound ? "bg-muted text-muted-foreground" : "bg-blue-500 text-white"
                          )}>
                            {nameInitials(senderName)}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold",
                            isInbound ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"
                          )}>
                            {senderName}
                          </span>
                          {meta.icon === "email" ? (
                            <Mail className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Linkedin className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="text-[11px] text-muted-foreground">{meta.label}</span>
                          <span className="text-[11px] text-muted-foreground/50 ml-auto shrink-0">{time}</span>
                        </div>
                        {/* Subject */}
                        {item.subject && (
                          <p className="text-[11px] text-muted-foreground mb-1">
                            Subject: <span className="font-medium text-foreground/70">{item.subject}</span>
                          </p>
                        )}
                        {/* Body */}
                        {bodyText ? (
                          <>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                              {bodyText}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic">No content</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function aiScoreBarColor(score: number): string {
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-blue-500";
  if (score >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

export function LeadProfileShell({ profile, lastSyncAt, mode, pendingCampaignId, userRole }: LeadProfileShellProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lemlist sync
  const [syncing, setSyncing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [isDirty, setIsDirty] = useState(profile.isLemlistDirty);
  const [isQueuedForLaunch, setIsQueuedForLaunch] = useState(false);
  const isPending = mode === "pending";
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const campaignIdParam = searchParams.get("campaignId");

  const msg = profile.contact?.messages[0] ?? null;
  const hasEmail = profile.sequenceType === "email";
  const flowNodes = hasEmail ? buildEmailSequence(msg) : buildLinkedinSequence(msg);
  const completedSteps = deriveCompletedActivities(profile.activities, hasEmail);
  const inviteAccepted = profile.activities.some(a => a.type === "linkedinInviteAccepted");
  const linkedinConnectDone = completedSteps.has("LinkedIn Invite");
  const isM5Skipped = linkedinConnectDone && !inviteAccepted && !completedSteps.has("M5");
  const sequenceDone = completedSteps.has("M6");
  const TOTAL_STEPS = 5;
  const M_STEP_LABELS = new Set(["M1", "M2", "M3", "LinkedIn Invite", "M5", "M6"]);
  const effectiveDone = sequenceDone
    ? TOTAL_STEPS
    : [...completedSteps.keys()].filter(k => M_STEP_LABELS.has(k)).length + (isM5Skipped ? 1 : 0);

  // Convert <br> in email body from DB to \n for textarea
  const toBr = (v: string | null | undefined) => (v ?? "").replace(/<br\s*\/?>/gi, "\n");
  const initDraft = () => ({
    m1Subject: msg?.m1Subject ?? "",
    m1BodyEmail: toBr(msg?.m1BodyEmail),
    m1BodyLi: msg?.m1BodyLi ?? "",
    m2Subject: msg?.m2Subject ?? "",
    m2BodyEmail: toBr(msg?.m2BodyEmail),
    m2BodyLi: msg?.m2BodyLi ?? "",
    m3Subject: msg?.m3Subject ?? "",
    m3BodyEmail: toBr(msg?.m3BodyEmail),
    m3BodyLi: msg?.m3BodyLi ?? "",
    m4LiConnReq: msg?.m4LiConnReq ?? "",
    m5LiChat: msg?.m5LiChat ?? "",
    m6Subject: msg?.m6Subject ?? "",
    m6BodyEmail: toBr(msg?.m6BodyEmail),
    m6BodyLi: msg?.m6BodyLi ?? "",
  });
  const [draft, setDraft] = useState<Record<string, string>>(initDraft);

  async function handleSave() {
    const contactId = profile.contact?.airtableId;
    if (!contactId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/messages/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setEditMode(false);
      setIsDirty(true);
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error while saving");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(initDraft());
    setEditMode(false);
    setSaveError(null);
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      const res = await fetch(`/api/leads/${profile.id}/discard`, { method: "POST" });
      if (!res.ok) throw new Error("Discard failed");
      toast.success("Changes reverted", {
        description: "Restored from Lemlist data.",
        duration: 3000,
      });
      setIsDirty(false);
      router.refresh();
    } catch (e) {
      toast.error("Discard failed", {
        description: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setDiscarding(false);
    }
  }

  async function handleLaunch() {
    setLaunching(true);
    try {
      const res = await fetch(`/api/leads/${profile.id}/launch`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Launch failed");
      }
      if (data.errors?.length) {
        toast.warning("Some items failed", {
          description: (data.errors as string[]).join("\n"),
          duration: 3000,
        });
      } else {
        toast.success("Lemlist Launch complete", {
          description: "Message sequence synced and sending started.",
          duration: 3000,
        });
        setIsDirty(false);
        setIsQueuedForLaunch(true);
        router.refresh();
      }
    } catch (e) {
      toast.error("Launch failed", {
        description: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setLaunching(false);
    }
  }

  async function handlePendingLaunch() {
    const airtableId = profile.contact?.airtableId;
    if (!airtableId || !pendingCampaignId) return;
    setLaunching(true);
    try {
      const launchRes = await fetch(`/api/campaigns/${pendingCampaignId}/launch/${airtableId}`, { method: "POST" });
      const launchData = await launchRes.json().catch(() => ({}));
      if (!launchRes.ok) throw new Error(launchData.error ?? "Launch failed");

      toast.loading("Running Lemlist Launch...", { id: "pending-sync" });
      await fetch("/api/sync", { method: "POST" });
      toast.dismiss("pending-sync");

      const lookupRes = await fetch(`/api/campaigns/${pendingCampaignId}/contacts/${airtableId}/lead`);
      if (lookupRes.ok) {
        const { id } = await lookupRes.json();
        toast.success("Lemlist Launch complete", { duration: 3000 });
        router.push(`/leads/${id}?from=campaign-analysis`);
      } else {
        toast.success("Launch complete -- check Campaign Analysis", { duration: 3000 });
        router.push("/?tab=campaign-analysis");
      }
    } catch (e) {
      toast.error("Launch failed", {
        description: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setLaunching(false);
    }
  }

  async function handleApplyChanges() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/leads/${profile.id}/sync-contact`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Sync failed");
      }
      if (data.errors?.length) {
        toast.warning("Some items failed to sync", {
          description: (data.errors as string[]).join("\n"),
          duration: 3000,
        });
      } else {
        toast.success("Changes applied to Lemlist.", { duration: 3000 });
        setIsDirty(false);
      }
    } catch (e) {
      toast.error("Apply failed", {
        description: e instanceof Error ? e.message : "Unknown error",
        duration: 3000,
      });
    } finally {
      setSyncing(false);
    }
  }


  function toggleStep(key: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleNavigate(page: SidebarPage) {
    if (page === "profile-analysis") return;
    router.push("/");
  }

  function renderStepCard(data: FlowStepData, key: string) {
    const isExpanded = expandedSteps.has(key);
    const sentDate = completedSteps.get(data.label);
    const isSent = sentDate !== undefined;
    const isSkipped = (data.label === "M5" && isM5Skipped) || (sequenceDone && !isSent);

    if (editMode && (data.subjectKey || data.bodyKey)) {
      return (
        <div className="rounded-lg border border-dashed p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{data.label}</span>
            <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0 text-xs h-5">
              {data.channel === "email" ? <><Mail className="h-3 w-3" />Email</> : <><svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn</>}
            </Badge>
          </div>
          {data.subjectKey && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Subject</span>
              <input
                className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                value={draft[data.subjectKey] ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, [data.subjectKey!]: e.target.value }))}
              />
            </div>
          )}
          {data.bodyKey && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Body</span>
              <textarea
                className="w-full text-sm border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y"
                value={draft[data.bodyKey] ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, [data.bodyKey!]: e.target.value }))}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={cn("rounded-lg border p-3 transition-opacity", isSent && "border-primary border-2", isSkipped && "opacity-40")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{data.label}</span>
          <Badge variant="outline" className="flex items-center gap-1 px-1.5 py-0 text-xs h-5">
            {data.channel === "email" ? (
              <><Mail className="h-3 w-3" />Email</>
            ) : (
              <><svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn</>
            )}
          </Badge>
          <span className="text-sm font-medium flex-1">{data.subject ?? "—"}</span>
          {isSent && (
            <span className="text-xs text-muted-foreground shrink-0">
              {sentDate ? sentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Sent"}
            </span>
          )}
          {data.label === "M5" && isM5Skipped && <span className="text-xs text-muted-foreground/60 shrink-0">Skipped</span>}
          {data.body && (
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => toggleStep(key)}>
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
        </div>
        {isExpanded && data.body && (
          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
            {data.body.replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/g, " ")}
          </p>
        )}
      </div>
    );
  }

  function renderNodes(nodes: FlowNode[], prefix: string, nested = false) {
    return nodes.map((node, i) => {
      const key = prefix ? `${prefix}-${i}` : `${i}`;
      const isLast = i === nodes.length - 1;
      const isSentStep = node.type === "step" && completedSteps.has(node.data.label);
      const isSkippedStep = node.type === "step" && sequenceDone && !completedSteps.has(node.data.label);

      if (node.type === "step") {
        if (nested) {
          return (
            <div key={key} className={i < nodes.length - 1 ? "mb-2" : ""}>
              {node.data.day !== undefined && (
                <p className="text-[11px] text-muted-foreground/60 mb-1">Day {node.data.day}</p>
              )}
              {renderStepCard(node.data, key)}
            </div>
          );
        }
        return (
          <div key={key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn("h-2.5 w-2.5 rounded-full mt-1 shrink-0", (isSentStep || sequenceDone) ? "bg-primary" : "bg-border")} />
              {!isLast && <div className={cn("w-px flex-1 mt-1 min-h-[1rem]", sequenceDone ? "bg-foreground/60" : "bg-border")} />}
            </div>
            <div className="flex-1 mb-2">
              {node.data.day !== undefined && (
                <p className="text-[11px] text-muted-foreground/60 mb-1">Day {node.data.day}</p>
              )}
              {renderStepCard(node.data, key)}
            </div>
          </div>
        );
      }

      const { conditionLabel, day, branches } = node.data;
      const activeIndex = (() => {
        const idx = branches.findIndex(b =>
          (b.deciderLabels ?? []).some(label => completedSteps.has(label))
        );
        if (idx >= 0) return idx;
        // "Not accepted" fallback: LinkedIn Invite sent but not accepted
        if (isM5Skipped) {
          const skippedIdx = branches.findIndex(b => (b.deciderLabels ?? []).length === 0);
          if (skippedIdx >= 0) return skippedIdx;
        }
        return -1;
      })();
      const isDecided = activeIndex >= 0;
      const branchContent = (
        <div className="flex-1 mb-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {day !== undefined && <span className="text-muted-foreground/60 mr-1">Day {day} ·</span>}
            Branch on {conditionLabel}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {branches.map((branch, bi) => {
              const isActive = isDecided && bi === activeIndex;
              const isInactive = isDecided && bi !== activeIndex;
              return (
                <div
                  key={bi}
                  className={cn(
                    "rounded-lg border border-border/60 p-3 transition-opacity",
                    isInactive && "opacity-35",
                    (!isDecided && !sequenceDone) && "bg-muted/20",
                    (!isDecided && sequenceDone) && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold">{branch.label}</p>
                    {isActive && (
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px] h-4 border-primary text-primary">
                        This path
                      </Badge>
                    )}
                  </div>
                  {branch.steps.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Skipped</p>
                  ) : (
                    <div className="flex flex-col">{renderNodes(branch.steps, `${key}-b${bi}`, true)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );

      if (nested) {
        return <div key={key} className={i < nodes.length - 1 ? "mb-2" : ""}>{branchContent}</div>;
      }

      return (
        <div key={key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={cn("h-2.5 w-2.5 rounded-full mt-1 shrink-0", (isDecided || sequenceDone) ? "bg-primary" : "bg-muted-foreground/30")} />
            {!isLast && <div className={cn("w-px flex-1 mt-1 min-h-[1rem]", sequenceDone ? "bg-foreground/60" : "bg-border")} />}
          </div>
          {branchContent}
        </div>
      );
    });
  }

  const contact = profile.contact;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activePage="profile-analysis" onNavigate={handleNavigate} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={contact?.name ?? "Profile Detail"}
          back={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const tab = from ?? (isPending ? "campaign-analysis" : null);
                if (!tab) { router.push("/"); return; }
                const cid = campaignIdParam ?? (isPending ? profile.campaignId : null);
                router.push(cid ? `/?tab=${tab}&campaignId=${cid}` : `/?tab=${tab}`);
              }}
              className="-ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          }
        />

        {!isPending && isDirty && (
          <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-8 py-2.5 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">Changes have not been applied to Lemlist yet. You can apply changes or discard edits.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                onClick={handleDiscard}
                disabled={discarding || syncing}
              >
                {discarding ? "Discarding..." : "Discard Changes"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleApplyChanges}
                disabled={syncing || discarding}
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", syncing && "animate-spin")} />
                {syncing ? "Applying..." : "Apply Changes"}
              </Button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-muted/40">
          <div className="px-8 py-8">
            {/* Two-column grid */}
            <div className="grid grid-cols-2 gap-8">
              {/* Left column */}
              <div className="flex flex-col gap-6">
                {/* BackgroundInfoCard */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Background Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!contact ? (
                      <p className="text-sm text-muted-foreground">No contact info</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-6">
                        {/* Left: basic info */}
                        <div className="flex flex-col divide-y divide-border">
                          <div className="flex flex-col gap-0.5 py-2.5 first:pt-0">
                            <span className="text-[11px] text-muted-foreground">Name</span>
                            <span className="text-sm font-medium">
                              {contact.name ?? "—"}
                              {contact.country && (
                                <span className="text-muted-foreground font-normal"> ({contact.country})</span>
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2.5">
                            <span className="text-[11px] text-muted-foreground">Company</span>
                            <span className="text-sm">{contact.company ?? "—"}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2.5">
                            <span className="text-[11px] text-muted-foreground">Title</span>
                            <span className="text-sm">{contact.role ?? "—"}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 py-2.5">
                            <span className="text-[11px] text-muted-foreground">Email</span>
                            <span className="text-sm">{contact.email ?? "—"}</span>
                          </div>
                          <div className="py-2.5">
                            <span className="text-[11px] text-muted-foreground block mb-1">LinkedIn</span>
                            {contact.linkedinUrl ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  LinkedIn
                                </a>
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                          {contact.experiences && (
                            <div className="flex flex-col gap-1 py-2.5">
                              <span className="text-[11px] text-muted-foreground">Experience</span>
                              {(() => {
                                try {
                                  const exps = JSON.parse(contact.experiences);
                                  if (Array.isArray(exps) && exps.length > 0) {
                                    return (
                                      <div className="flex flex-col gap-3">
                                        {exps.map((exp: { company?: string; title?: string; duration?: string }, i: number) => (
                                          <div key={i} className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium">{exp.title ?? "—"}</span>
                                            <span className="text-sm text-muted-foreground">{exp.company}</span>
                                            {exp.duration && <span className="text-xs text-muted-foreground">{exp.duration}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                } catch {}
                                return <p className="text-sm leading-relaxed whitespace-pre-wrap">{contact.experiences}</p>;
                              })()}
                            </div>
                          )}
                          <div className="py-2.5">
                            <p className="text-xs text-muted-foreground">
                              {formatSyncTimestamp(lastSyncAt)}{profile.contact?.airtableId && ` (${profile.contact.airtableId})`}
                            </p>
                          </div>
                        </div>

                        {/* Right: About */}
                        <div className="flex flex-col gap-4">
                          {contact.about && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[11px] text-muted-foreground">About</span>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{contact.about}</p>
                            </div>
                          )}
                          {!contact.about && (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AiAnalysisCard */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex flex-col gap-4">
                    {contact?.aiScore !== null && contact?.aiScore !== undefined && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">AI Score</span>
                          <span className="text-sm font-semibold">{contact.aiScore}/10</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${aiScoreBarColor(contact.aiScore)}`}
                            style={{ width: `${(contact.aiScore / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {contact?.aiScoringReason && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">Scoring Reason</span>
                        <p className="text-sm leading-relaxed">{contact.aiScoringReason}</p>
                      </div>
                    )}
                    {contact?.aiRecentInteractionsSummary && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">Recent Interests / Interactions Summary</span>
                        <p className="text-sm leading-relaxed">{contact.aiRecentInteractionsSummary}</p>
                      </div>
                    )}
                    {!contact?.aiScoringReason && !contact?.aiRecentInteractionsSummary && (
                      <p className="text-sm text-muted-foreground">No AI analysis data</p>
                    )}
                  </CardContent>
                </Card>

                {/* Inbox */}
                {!isPending ? (
                  <LemlistInboxCard
                    leadId={profile.id}
                    contactName={contact?.name}
                    assigneeName={contact?.assignee}
                  />
                ) : (
                  <ActivityHistoryCard
                    activities={profile.activities as ActivityItem[]}
                    contactName={contact?.name}
                    assigneeName={contact?.assignee}
                    message={msg}
                    hasEmail={hasEmail}
                  />
                )}
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6">
                {/* CampaignStatusCard */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Campaign Status
                      </CardTitle>
                      {isPending && (
                        <Button
                          size="sm"
                          className="h-8 text-sm px-3 bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={handlePendingLaunch}
                          disabled={launching}
                        >
                          <Rocket className={cn("h-3.5 w-3.5 mr-1.5", launching && "animate-pulse")} />
                          {launching ? "Launching..." : "Lemlist Launch"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-col divide-y divide-border">
                      <div className="flex flex-col gap-0.5 py-2.5 first:pt-0">
                        <span className="text-[11px] text-muted-foreground">Campaign</span>
                        <span className="text-sm font-medium">{profile.campaign.name}</span>
                      </div>
                      {profile.campaign.status && (
                        <div className="flex flex-col gap-0.5 py-2.5">
                          <span className="text-[11px] text-muted-foreground">Campaign Status</span>
                          <span className="text-sm">{profile.campaign.status}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 py-2.5">
                        <span className="text-[11px] text-muted-foreground">Lead Status</span>
                        <div className="mt-0.5">
                          {isQueuedForLaunch ? (
                            <Badge className="border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Queued for Launch
                            </Badge>
                          ) : (
                            <StatusBadge
                              state={profile.state}
                              sequenceComplete={(() => {
                                if (GREEN_STATES.has(profile.state ?? "") || RED_STATES.has(profile.state ?? "")) return false;
                                const total = profile.totalSequenceSteps ?? Math.max(0, ...profile.activities.map((a) => a.totalSequenceSteps ?? 0));
                                return total > 0 && profile.sequenceStep !== null && profile.sequenceStep >= total;
                              })()}
                            />
                          )}
                        </div>
                      </div>
                      <div className="py-2.5">
                        <SequenceBar
                          step={profile.activities.length > 0 ? effectiveDone : profile.sequenceStep}
                          total={profile.activities.length > 0 ? TOTAL_STEPS : profile.totalSequenceSteps}
                        />
                      </div>
                      {profile.assignedAt && (
                        <div className="flex flex-col gap-0.5 py-2.5">
                          <span className="text-[11px] text-muted-foreground">Assigned Date</span>
                          <span className="text-sm">
                            {new Date(profile.assignedAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* MessageSequenceCard */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Message Sequence
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1 px-2 py-0.5 text-xs">
                          {hasEmail ? (
                            <><Mail className="h-3 w-3" />Email Sequence</>
                          ) : (
                            <><svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>LinkedIn Sequence</>
                          )}
                        </Badge>
                        {!editMode ? (
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setEditMode(true)}>
                            Edit
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleCancel} disabled={saving}>
                              Cancel
                            </Button>
                            <Button size="sm" className="h-6 text-xs px-2" onClick={handleSave} disabled={saving}>
                              {saving ? "Saving..." : "Save"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {saveError && (
                      <p className="text-xs text-destructive mt-1">{saveError}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 max-h-[600px] overflow-y-auto">
                    {!msg && (
                      <p className="text-xs text-muted-foreground italic mb-3">No message data -- showing sequence structure only</p>
                    )}
                    <div className="relative flex flex-col gap-0">
                      {renderNodes(flowNodes, "")}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
