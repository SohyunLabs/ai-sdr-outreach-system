import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, Activity, CheckCircle, UserCheck, MailOpen, MessageCircle, AlertTriangle } from "lucide-react";
import { type CampaignSummary } from "@/lib/dashboard-utils";

interface SummaryCardsProps {
  summary: CampaignSummary;
}

const MAIN_CARDS = [
  { key: "total" as const, label: "Total Leads", icon: Users, color: "var(--color-chart-1)" },
  { key: "waiting" as const, label: "Pending", icon: Clock, color: "#f59e0b" },
  { key: "inProgress" as const, label: "In Progress", icon: Activity, color: "var(--color-chart-2)" },
];

const ENDED_COLOR = "#6b7280";

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {MAIN_CARDS.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="border-t-2" style={{ borderTopColor: color }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold" style={{ color }}>
              {label}
            </CardTitle>
            <Icon className="h-4 w-4 shrink-0" style={{ color }} />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {summary[key]}
            </p>
          </CardContent>
        </Card>
      ))}
      <Card className="border-t-2" style={{ borderTopColor: ENDED_COLOR }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold" style={{ color: ENDED_COLOR }}>
            Ended
          </CardTitle>
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: ENDED_COLOR }} />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {summary.ended}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">LinkedIn Accept</p>
            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-semibold tabular-nums">{summary.liAccepted}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">({summary.liAcceptedCount}/{summary.liInvited})</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Open</p>
            <MailOpen className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-semibold tabular-nums">{summary.openRate}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">({summary.openCount}/{summary.messageSentCount})</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Reply</p>
            <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-semibold tabular-nums">{summary.replyRate}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">({summary.replyCount}/{summary.messageSentCount})</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Bounce/Fail</p>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <p className="text-xl font-semibold tabular-nums text-red-500">{summary.bounceRate}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">({summary.bounceCount}/{summary.messageSentCount})</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
