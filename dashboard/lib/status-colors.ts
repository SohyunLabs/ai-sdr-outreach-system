export const STATE_LABELS: Record<string, string> = {
  tolaunch: "To Launch",
  scanned: "Scanned",
  launching: "Launching",
  reviewed: "Reviewed",
  emailsSent: "Email Sent",
  emailsOpened: "Email Opened",
  emailsReplied: "Email Replied",
  emailsBounced: "Email Bounced",
  emailsFailed: "Send Failed",
  linkedinVisitDone: "LinkedIn Visit",
  linkedinMessageSent: "LinkedIn Message",
  linkedinInviteSent: "LinkedIn Invite Sent",
  linkedinInviteDone: "LinkedIn Invite Done",
  linkedinInviteAccepted: "LinkedIn Accepted",
  linkedinReplied: "LinkedIn Replied",
  linkedinSendFailed: "LinkedIn Send Failed",
  interested: "Interested",
  notInterested: "Not Interested",
  unsubscribed: "Unsubscribed",
  apiUnsubscribed: "Unsubscribed",
  paused: "Paused",
  done: "Complete",
  skipped: "Skipped",
};

export const STATE_COLORS: Record<string, string> = {
  // Purple (pending platform assignment)
  tolaunch: "bg-purple-500 text-white",
  // Amber (pending - not yet launched)
  scanned: "bg-amber-500 text-white",
  // Blue (in progress)
  launching: "bg-blue-400 text-white",
  reviewed: "bg-blue-500 text-white",
  emailsSent: "bg-blue-500 text-white",
  emailsOpened: "bg-blue-500 text-white",
  linkedinVisitDone: "bg-blue-500 text-white",
  linkedinMessageSent: "bg-blue-500 text-white",
  linkedinInviteSent: "bg-blue-500 text-white",
  linkedinInviteDone: "bg-blue-500 text-white",
  linkedinInviteAccepted: "bg-blue-500 text-white",
  // Gray (in progress - paused/skipped)
  paused: "bg-gray-400 text-white",
  skipped: "bg-gray-400 text-white",
  // Green (ended - replied)
  emailsReplied: "bg-green-500 text-white",
  linkedinReplied: "bg-green-500 text-white",
  // Green (badge display - excluded from counts)
  interested: "bg-green-500 text-white",
  // Red (ended - bounced/failed)
  emailsBounced: "bg-red-500 text-white",
  emailsFailed: "bg-red-500 text-white",
  linkedinSendFailed: "bg-red-500 text-white",
  unsubscribed: "bg-red-500 text-white",
  apiUnsubscribed: "bg-red-500 text-white",
  // Red (badge display - excluded from counts)
  notInterested: "bg-red-500 text-white",
  // Gray (ended - other)
  done: "bg-gray-400 text-white",
  manual: "bg-gray-400 text-white",
};

const DEFAULT_COLOR = "bg-gray-400 text-white";

export function getStatusColor(state: string | null): string {
  if (!state) return DEFAULT_COLOR;
  return STATE_COLORS[state] ?? DEFAULT_COLOR;
}

// Sort order: blue(0) → red(1) → green(2) → gray(3)
// Active states first, then problems, then replies (already handled), then completed
export const WAITING_STATES = new Set(["tolaunch", "scanned"]);
export const BLUE_STATES = new Set([
  "launching",
  "reviewed",
  "emailsSent",
  "emailsOpened",
  "linkedinVisitDone",
  "linkedinMessageSent",
  "linkedinInviteSent",
  "linkedinInviteDone",
  "linkedinInviteAccepted",
  "paused",
  "skipped",
]);
export const GREEN_STATES = new Set(["emailsReplied", "linkedinReplied"]);
export const RED_STATES = new Set(["emailsBounced", "emailsFailed", "unsubscribed", "apiUnsubscribed", "linkedinSendFailed"]);
export const NEUTRAL_STATES = new Set(["done"]);
export const CUSTOMER_ACTION_STATES = new Set(["emailsOpened", "linkedinInviteAccepted"]);

// --- Status Group (To Launch / In Progress / Complete) ---

export type StatusGroup = "to-launch" | "in-progress" | "complete";

export function getStatusGroup(state: string | null, isComplete: boolean): StatusGroup {
  if (WAITING_STATES.has(state ?? "")) return "to-launch";
  if (isComplete || NEUTRAL_STATES.has(state ?? "") || GREEN_STATES.has(state ?? "") || RED_STATES.has(state ?? "")) return "complete";
  return "in-progress";
}

export function getStatusGroupColor(group: StatusGroup, state: string | null): string {
  if (group === "to-launch") return "bg-amber-500 text-white";
  if (group === "in-progress") return "bg-blue-500 text-white";
  return "bg-gray-400 text-white";
}

const ACTION_LABEL_OVERRIDES: Record<string, string> = {
  emailsFailed: "Email Send Failed",
  linkedinSendFailed: "LinkedIn Send Failed",
  emailsReplied: "Email Replied",
  linkedinReplied: "LinkedIn Replied",
  done: "Sequence Complete",
  tolaunch: "Awaiting Launch",
  scanned: "Awaiting Launch",
};

export function getActionLabel(state: string | null, isComplete: boolean, lemlistStatus?: string | null): string {
  if (WAITING_STATES.has(state ?? "")) return "Awaiting Launch";
  if (isComplete && !GREEN_STATES.has(state ?? "") && !RED_STATES.has(state ?? "") && lemlistStatus === "done") return "Sequence Complete";
  return ACTION_LABEL_OVERRIDES[state ?? ""] ?? STATE_LABELS[state ?? ""] ?? state ?? "—";
}

export function getActionColor(state: string | null, isComplete: boolean, lemlistStatus?: string | null): string {
  if (WAITING_STATES.has(state ?? "")) return "border border-amber-400 bg-transparent text-amber-700";
  if (GREEN_STATES.has(state ?? "")) return "border border-green-500 bg-transparent text-green-600";
  if (RED_STATES.has(state ?? "")) return "border border-red-400 bg-transparent text-red-600";
  if (isComplete && lemlistStatus === "done") return "border border-gray-300 bg-transparent text-gray-500";
  if (CUSTOMER_ACTION_STATES.has(state ?? "")) return "border border-blue-400 bg-transparent text-blue-600";
  return "border border-gray-400 bg-transparent text-gray-700";
}

export function getStatusSortOrder(state: string | null): number {
  if (!state) return 4;
  if (WAITING_STATES.has(state)) return 0;
  if (BLUE_STATES.has(state)) return 1;
  if (RED_STATES.has(state)) return 2;
  if (GREEN_STATES.has(state)) return 3;
  return 4;
}

