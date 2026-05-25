"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar, type SidebarPage } from "@/components/dashboard/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Mail,
  ExternalLink,
  Settings,
} from "lucide-react";
import { buildEmailSequence, buildLinkedinSequence, ACTIVITY_META, groupActivitiesByDate, getActivityMessageLabel, getBodyByLabel, type FlowNode, type FlowStepData, type ActivityItem, type MessageForActivity } from "@/lib/lead-profile-utils";
const CONTACT_CONTENT_TYPES = new Set(["emailsSent", "linkedinSent", "linkedinConnect", "linkedinInviteDone"]);
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatSyncTimestamp } from "@/lib/dashboard-utils";
import { GREEN_STATES, RED_STATES } from "@/lib/status-colors";
import type { ContactProfileData } from "@/lib/lead-data";

type ExperienceItem = {
  company?: string;
  title?: string;
  location?: string;
  duration?: string;
  employment_type?: string;
};

interface ContactProfileShellProps {
  profile: ContactProfileData;
  parsedExperiences: ExperienceItem[] | null;
  lastSyncAt: Date | null;
}

function nameInitialsContact(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0]?.toUpperCase() ?? "?";
}

function ContactActivityHistoryCard({
  activities,
  contactName,
  messagesByCampaign,
}: {
  activities: ActivityItem[];
  contactName?: string | null;
  messagesByCampaign?: Map<string, MessageForActivity>;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const grouped = groupActivitiesByDate(activities); // ascending

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
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground/70 shrink-0">{date}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="flex flex-col gap-2">
                  {items.map((activity) => {
                    const meta = ACTIVITY_META[activity.type];
                    const isInbound = meta?.isInbound ?? false;
                    const isContentActivity = CONTACT_CONTENT_TYPES.has(activity.type);
                    // Outbound sent: lookup content from campaign message template
                    let displayBody: string | null = isInbound ? (activity.content ?? null) : null;
                    if (!isInbound && isContentActivity && activity.type !== "linkedinInviteDone" && messagesByCampaign && activity.campaignId) {
                      const campaignActivities = activities.filter(a => a.campaignId === activity.campaignId);
                      const hasEmailInCampaign = campaignActivities.some(a => a.type === "emailsSent");
                      const msgLabel = getActivityMessageLabel(activity.id, campaignActivities, hasEmailInCampaign);
                      const msg = messagesByCampaign.get(activity.campaignId) ?? null;
                      const looked = getBodyByLabel(msgLabel, msg, meta?.channel);
                      displayBody = looked.body;
                    }
                    // linkedinInviteDone is always status-only (shown without content)
                    const isStatusOnly = (!isInbound && !isContentActivity) ||
                      activity.type === "linkedinInviteDone";
                    const isExpanded = expandedIds.has(activity.id);
                    const time = new Date(activity.occurredAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

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
                          {activity.campaignName && (
                            <span className="text-[10px] bg-muted rounded px-1 text-muted-foreground">{activity.campaignName}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground/50 shrink-0">{time}</span>
                        </div>
                      );
                    }

                    const senderName = isInbound ? (contactName ?? "Lead") : "Team";

                    return (
                      <div key={activity.id} className={cn(
                        "rounded-lg border-l-2 px-3 py-2.5",
                        isInbound
                          ? "border-l-green-500 bg-green-50/60 dark:bg-green-950/20"
                          : "border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20"
                      )}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={cn(
                            "inline-flex h-5 w-5 rounded-full items-center justify-center text-[10px] font-bold shrink-0",
                            isInbound ? "bg-muted text-muted-foreground" : "bg-blue-500 text-white"
                          )}>
                            {nameInitialsContact(senderName)}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold",
                            isInbound ? "text-green-700 dark:text-green-400" : "text-blue-700 dark:text-blue-400"
                          )}>
                            {senderName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">· {meta?.label ?? activity.type}</span>
                          {activity.campaignName && (
                            <span className="text-[10px] bg-muted rounded px-1 text-muted-foreground ml-1">{activity.campaignName}</span>
                          )}
                          <span className="text-[11px] text-muted-foreground/50 ml-auto shrink-0">{time}</span>
                        </div>

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
                          isContentActivity && <p className="text-xs text-muted-foreground/50 italic">No content</p>
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

export function ContactProfileShell({ profile, parsedExperiences, lastSyncAt }: ContactProfileShellProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const msg = profile.messages[0] ?? null;
  const hadEmailCampaign = profile.leads.some(l => l.sequenceType === "email");
  const flowNodes = hadEmailCampaign ? buildEmailSequence(msg) : buildLinkedinSequence(msg);

  // Campaign ID -> message template mapping (for ContactActivityHistoryCard)
  const messagesByCampaign = new Map<string, MessageForActivity>(
    profile.messages
      .filter(m => m.campaignId)
      .map(m => [m.campaignId!, m])
  );

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
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/messages/${profile.airtableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      setEditMode(false);
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(initDraft());
    setEditMode(false);
    setSaveError(null);
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
      <div className="rounded-lg border p-3">
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
              <div className="h-2.5 w-2.5 rounded-full mt-1 shrink-0 bg-border" />
              {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[1rem]" />}
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
      const branchContent = (
        <div className="flex-1 mb-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {day !== undefined && <span className="text-muted-foreground/60 mr-1">Day {day} ·</span>}
            Branch by {conditionLabel}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {branches.map((branch, bi) => (
              <div key={bi} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold mb-2">{branch.label}</p>
                {branch.steps.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Skipped</p>
                ) : (
                  <div className="flex flex-col">{renderNodes(branch.steps, `${key}-b${bi}`, true)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );

      if (nested) {
        return (
          <div key={key} className={i < nodes.length - 1 ? "mb-2" : ""}>
            {branchContent}
          </div>
        );
      }

      return (
        <div key={key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full mt-1 shrink-0 bg-muted-foreground/30" />
            {!isLast && <div className="w-px flex-1 bg-border mt-1 min-h-[1rem]" />}
          </div>
          {branchContent}
        </div>
      );
    });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activePage="profile-analysis" onNavigate={handleNavigate} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={profile.name ?? "Profile Details"}
          subtitle={[profile.role, profile.company].filter(Boolean).join(" · ")}
          back={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(from ? `/?tab=${from}` : "/")}
              className="-ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          }
        />

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
                    <div className="grid grid-cols-2 gap-x-6">
                      {/* Left: basic info */}
                      <div className="flex flex-col divide-y divide-border">
                        <div className="flex flex-col gap-0.5 py-2.5 first:pt-0">
                          <span className="text-[11px] text-muted-foreground">Name</span>
                          <span className="text-sm font-medium">
                            {profile.name ?? "—"}
                            {profile.country && (
                              <span className="text-muted-foreground font-normal"> ({profile.country})</span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 py-2.5">
                          <span className="text-[11px] text-muted-foreground">Company</span>
                          <span className="text-sm">{profile.company ?? "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 py-2.5">
                          <span className="text-[11px] text-muted-foreground">Title</span>
                          <span className="text-sm">{profile.role ?? "—"}</span>
                        </div>
                        <div className="flex flex-col gap-0.5 py-2.5">
                          <span className="text-[11px] text-muted-foreground">Email</span>
                          <span className="text-sm">{profile.email ?? "—"}</span>
                        </div>
                        <div className="py-2.5">
                          <span className="text-[11px] text-muted-foreground block mb-1">LinkedIn</span>
                          {profile.linkedinUrl ? (
                            <Button variant="outline" size="sm" asChild>
                              <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                LinkedIn
                              </a>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="py-2.5">
                          <p className="text-xs text-muted-foreground">
                            {formatSyncTimestamp(lastSyncAt)} ({profile.airtableId})
                          </p>
                        </div>
                      </div>

                      {/* Right: About + Experience */}
                      <div className="flex flex-col gap-4">
                        {profile.about && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-muted-foreground">About</span>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.about}</p>
                          </div>
                        )}
                        {profile.experiences && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-muted-foreground">Experience</span>
                            {parsedExperiences ? (
                              <div className="flex flex-col gap-3">
                                {parsedExperiences.map((exp, i) => (
                                  <div key={i} className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium">{exp.title ?? "—"}</span>
                                    <span className="text-sm text-muted-foreground">{exp.company}</span>
                                    {exp.duration && <span className="text-xs text-muted-foreground">{exp.duration}</span>}
                                    {exp.location && <span className="text-xs text-muted-foreground">{exp.location}</span>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.experiences}</p>
                            )}
                          </div>
                        )}
                        {!profile.about && !profile.experiences && (
                          <p className="text-sm text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
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
                    {profile.aiScore != null && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">AI Score</span>
                          <span className="text-sm font-semibold">{profile.aiScore}/10</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${aiScoreBarColor(profile.aiScore)}`}
                            style={{ width: `${(profile.aiScore / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {profile.aiScoringReason && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">Scoring Reason</span>
                        <p className="text-sm leading-relaxed">{profile.aiScoringReason}</p>
                      </div>
                    )}
                    {profile.aiRecentInteractionsSummary && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">Recent Interests / Interactions Summary</span>
                        <p className="text-sm leading-relaxed">{profile.aiRecentInteractionsSummary}</p>
                      </div>
                    )}
                    {!profile.aiScoringReason && !profile.aiRecentInteractionsSummary && (
                      <p className="text-sm text-muted-foreground">No AI analysis data</p>
                    )}
                  </CardContent>
                </Card>

                {/* ActivityHistoryCard */}
                <ContactActivityHistoryCard
                  contactName={profile.name}
                  messagesByCampaign={messagesByCampaign}
                  activities={profile.leads.flatMap((lead) =>
                    (lead.activities ?? []).map((a) => ({
                      ...a,
                      campaignName: lead.campaign.name,
                      campaignId: lead.campaignId,
                    }))
                  )}
                />
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-6">
                {/* CampaignStatusCard */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Campaign Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {profile.leads.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No campaigns yet</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border">
                        {profile.leads.map((lead) => (
                          <div key={lead.id} className="flex items-center justify-between py-2.5 first:pt-0">
                            <span className="text-sm text-muted-foreground">{lead.campaign.name}</span>
                            <StatusBadge
                              state={lead.state}
                              sequenceComplete={(() => {
                                if (GREEN_STATES.has(lead.state ?? "") || RED_STATES.has(lead.state ?? "")) return false;
                                const total = lead.totalSequenceSteps ?? Math.max(0, ...lead.activities.map((a) => a.totalSequenceSteps ?? 0));
                                return total > 0 && lead.sequenceStep !== null && lead.sequenceStep >= total;
                              })()}
                            />
                          </div>
                        ))}
                      </div>
                    )}
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
                          {hadEmailCampaign ? (
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
