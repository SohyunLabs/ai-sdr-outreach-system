import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLeadActivities } from "@/lib/lemlist";

export interface InboxItem {
  id: string;
  type:
    | "email-sent"
    | "email-reply"
    | "email-bounced"
    | "email-opened"
    | "linkedin-connect"
    | "linkedin-message"
    | "linkedin-opened"
    | "linkedin-reply"
    | "linkedin-accepted"
    | "linkedin-visit";
  subject?: string;
  body?: string;
  isHtml: boolean;
  occurredAt: string;
  isInbound: boolean;
  senderName?: string;
}

type MessageTemplate = {
  m4LiConnReq?: string | null;
  m5LiChat?: string | null;
  m1BodyLi?: string | null;
  m1BodyEmail?: string | null;
  m2BodyLi?: string | null;
  m2BodyEmail?: string | null;
  m3BodyLi?: string | null;
  m3BodyEmail?: string | null;
  m6BodyLi?: string | null;
  m6BodyEmail?: string | null;
  m1Subject?: string | null;
  m2Subject?: string | null;
  m3Subject?: string | null;
  m6Subject?: string | null;
};

/** LinkedIn 시퀀스 레이블로 DB 템플릿 body 반환 */
function linkedinBodyByLabel(label: string, msg: MessageTemplate | null): string {
  if (!msg) return "";
  switch (label) {
    case "M4": return msg.m4LiConnReq ?? "";
    case "M5": return msg.m5LiChat ?? "";
    case "M1": return msg.m1BodyLi ?? msg.m1BodyEmail ?? "";
    case "M2": return msg.m2BodyLi ?? msg.m2BodyEmail ?? "";
    case "M3": return msg.m3BodyLi ?? msg.m3BodyEmail ?? "";
    case "M6": return msg.m6BodyLi ?? msg.m6BodyEmail ?? "";
    default: return "";
  }
}

/** 이메일 전송 activity에서 제목/본문 추출 (DB 템플릿 매칭) */
function matchEmailContent(
  a: Record<string, unknown>,
  msg: MessageTemplate | null
): { subject: string; body: string } {
  if (msg) {
    const sentSubj = ((a.subject as string) || "").toLowerCase().trim();
    const pairs: [string | null | undefined, string | null | undefined][] = [
      [msg.m1Subject, msg.m1BodyEmail],
      [msg.m2Subject, msg.m2BodyEmail],
      [msg.m3Subject, msg.m3BodyEmail],
      [msg.m6Subject, msg.m6BodyEmail],
    ];
    for (const [subj, body] of pairs) {
      if (subj && sentSubj === subj.toLowerCase().trim()) {
        return { subject: subj, body: body ?? "" };
      }
    }
  }
  return { subject: (a.subject as string) || "", body: (a.messagePreview as string) || "" };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lead = await prisma.campaignLead.findUnique({
    where: { id },
    select: { lemlistLeadId: true, campaignId: true, airtableContactId: true, sequenceType: true },
  });

  if (!lead?.lemlistLeadId) {
    console.log(`[inbox] no lemlistLeadId for id=${id}`);
    return NextResponse.json([]);
  }

  try {
    const [activities, contactData, neonActivities] = await Promise.all([
      fetchLeadActivities(lead.campaignId, lead.lemlistLeadId),
      lead.airtableContactId
        ? prisma.contact.findUnique({
            where: { airtableId: lead.airtableContactId },
            select: {
              messages: {
                select: {
                  m4LiConnReq: true,
                  m5LiChat: true,
                  m1BodyLi: true, m1BodyEmail: true, m1Subject: true,
                  m2BodyLi: true, m2BodyEmail: true, m2Subject: true,
                  m3BodyLi: true, m3BodyEmail: true, m3Subject: true,
                  m6BodyLi: true, m6BodyEmail: true, m6Subject: true,
                },
                take: 1,
              },
            },
          })
        : null,
      prisma.$queryRaw<Array<{ lemlist_activity_id: string | null; content: string | null }>>`
        SELECT lemlist_activity_id, content FROM activities WHERE campaign_lead_id = ${id}
      `,
    ]);

    const message = contactData?.messages[0] ?? null;

    // lemlist_activity_id → Neon content 맵 (전문이 저장된 소스)
    const neonContentMap = new Map<string, string | null>();
    for (const na of neonActivities) {
      if (na.lemlist_activity_id) neonContentMap.set(na.lemlist_activity_id, na.content);
    }

    const allTypes = [...new Set(activities.map(a => a.type))];
    console.log(`[inbox] leadId=${lead.lemlistLeadId} activities=${activities.length} types:`, allTypes);

    // 시퀀스 타입 판별
    const hasEmail = lead.sequenceType === "email";
    const inviteAccepted = activities.some(a => a.type === "linkedinInviteAccepted");

    // 첫 번째 답장 이후 아웃바운드는 수동 발송 — 시퀀스 레이블 미포함
    const sortedAll = [...activities].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const firstReply = sortedAll.find(a => a.type === "linkedinReplied" || a.type === "emailsReplied");
    const cutoff = firstReply ? new Date(firstReply.createdAt).getTime() : Infinity;

    // linkedinSent를 시간순 정렬 후 레이블 매핑 (DB 템플릿 fallback용) — 수동 발송 및 답장 이후 제외
    const sortedLinkedinSents = sortedAll
      .filter(a => a.type === "linkedinSent" && !(a as Record<string, unknown>).sentOutSideOfLemlist && new Date(a.createdAt).getTime() <= cutoff);

    const linkedinSentLabels = new Map<string, string>();
    sortedLinkedinSents.forEach((sent, idx) => {
      if (hasEmail) {
        linkedinSentLabels.set(sent._id, "M5");
      } else if (inviteAccepted) {
        linkedinSentLabels.set(sent._id, (["M5", "M1", "M2", "M6"] as const)[idx] ?? "M6");
      } else {
        linkedinSentLabels.set(sent._id, (["M1", "M2", "M6"] as const)[idx] ?? "M6");
      }
    });

    const items: InboxItem[] = [];

    for (const raw of activities) {
      const a = raw as Record<string, unknown>;
      const base = {
        id: (a._id as string) || String(Date.now() + Math.random()),
        occurredAt: (a.createdAt as string) || new Date().toISOString(),
        senderName: (a.sendUserName as string) || undefined,
      };

      switch (a.type as string) {
        case "emailsSent": {
          const subject = (a.subject as string) || "";
          const neonContent = neonContentMap.get(a._id as string) ?? null;
          // Neon content 우선 (전문, <br> 포함) → fallback: subject 기반 DB 템플릿 매칭
          const body = neonContent ?? matchEmailContent(a, message).body;
          items.push({ ...base, type: "email-sent", subject, body, isHtml: true, isInbound: false });
          break;
        }
        case "emailsReplied":
          items.push({
            ...base,
            type: "email-reply",
            body: (a.value as string) || (a.messagePreview as string) || (a.content as string) || "",
            isHtml: false,
            isInbound: true,
          });
          break;
        case "emailsBounced":
          items.push({ ...base, type: "email-bounced", isHtml: false, isInbound: false });
          break;
        case "emailsOpened":
          items.push({ ...base, type: "email-opened", isHtml: false, isInbound: false });
          break;
        // linkedinInviteDone = 일촌 신청 보냄 (Lemlist 실제 타입명)
        case "linkedinInviteDone":
        case "linkedinConnect":
          items.push({
            ...base,
            type: "linkedin-connect",
            // Neon content 우선 → fallback: Lemlist API 필드
            body: neonContentMap.get(a._id as string) ?? ((a.m4LIConnReqBody as string) || ""),
            isHtml: false,
            isInbound: false,
          });
          break;
        case "linkedinSent": {
          const neonContent = neonContentMap.get(a._id as string) ?? null;
          // Neon content 우선 → fallback: Lemlist API text/message → DB 템플릿
          const label = linkedinSentLabels.get(a._id as string) ?? "M5";
          const body = neonContent ?? ((a.text as string) || (a.message as string) || linkedinBodyByLabel(label, message) || "");
          items.push({
            ...base,
            type: "linkedin-message",
            body,
            isHtml: false,
            isInbound: false,
          });
          break;
        }
        case "linkedinReplied":
          items.push({
            ...base,
            type: "linkedin-reply",
            // 실제 답장 내용: text 필드 (value 아님)
            body: (a.text as string) || (a.value as string) || "",
            isHtml: false,
            isInbound: true,
          });
          break;
        case "linkedinOpened":
          items.push({ ...base, type: "linkedin-opened", isHtml: false, isInbound: false });
          break;
        case "linkedinInviteAccepted":
          items.push({ ...base, type: "linkedin-accepted", isHtml: false, isInbound: true });
          break;
        case "linkedinVisit":
          items.push({ ...base, type: "linkedin-visit", isHtml: false, isInbound: false });
          break;
        default: {
          // 미처리 타입 로그 — 타입명 확인용
          const t = a.type as string;
          console.log(`[inbox] unhandled type="${t}" raw:`, JSON.stringify(a));
          break;
        }
      }
    }

    items.sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    console.log(`[inbox] items built: ${items.length}`, items.map(i => i.type));
    return NextResponse.json(items);
  } catch (e) {
    console.error("[inbox] ERROR:", e);
    return NextResponse.json([]);
  }
}
