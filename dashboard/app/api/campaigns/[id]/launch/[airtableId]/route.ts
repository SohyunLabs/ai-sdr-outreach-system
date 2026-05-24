import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; airtableId: string }> }
) {
  const { id: campaignId, airtableId } = await params;

  const [contact, campaign] = await Promise.all([
    prisma.contact.findUnique({
      where: { airtableId },
      include: { messages: { where: { campaignId }, take: 1 } },
    }),
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } }),
  ]);

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }
  // LinkedIn-only leads: use placeholder email so Lemlist can track them.
  // The campaign must have no email steps — Lemlist will use linkedinUrl for outreach.
  const lemlistEmail = contact.email ?? `li.${airtableId}@noemail.placeholder`;

  const msg = contact.messages[0];
  if (!msg) {
    return NextResponse.json({ error: "No message found for this campaign" }, { status: 404 });
  }

  const toBr = (v: string | null | undefined) =>
    (v ?? "").replace(/\n/g, "<br>");

  const nameParts = (contact.name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  const payload: Record<string, string> = {};
  if (contact.linkedinUrl) payload.linkedinUrl = contact.linkedinUrl;
  payload.airtableContactId = contact.airtableId;
  if (contact.company) payload.companyName = contact.company;
  if (firstName) payload.firstName = firstName;
  if (lastName) payload.lastName = lastName;
  if (contact.role) payload.jobTitle = contact.role;
  if (contact.about) payload.jobDescription = contact.about;
  if (contact.country) payload.location = contact.country;
  if (contact.assignee) payload.assignee = contact.assignee;
  payload.email = lemlistEmail;
  if (msg.m1Subject) payload.m1InitialSubject = msg.m1Subject;
  if (msg.m1BodyEmail) payload.m1InitialBody = toBr(msg.m1BodyEmail);
  if (msg.m1BodyLi) payload.m1InitialBodyLI = msg.m1BodyLi;
  if (msg.m2Subject) payload.m2FU1EmailOpenSubject = msg.m2Subject;
  if (msg.m2BodyEmail) payload.m2FU1EmailOpenBody = toBr(msg.m2BodyEmail);
  if (msg.m2BodyLi) payload.m2FU1EmailOpenBodyLI = msg.m2BodyLi;
  if (msg.m3Subject) payload.m3FU1EmailCloseSubject = msg.m3Subject;
  if (msg.m3BodyEmail) payload.m3FU1EmailCloseBody = toBr(msg.m3BodyEmail);
  if (msg.m3BodyLi) payload.m3FU1EmailCloseBodyLI = msg.m3BodyLi;
  if (msg.m4LiConnReq) payload.m4LIConnReqBody = msg.m4LiConnReq;
  if (msg.m5LiChat) payload.m5LIChatBody = msg.m5LiChat;
  if (msg.m6Subject) payload.m6FinalSubject = msg.m6Subject;
  if (msg.m6BodyEmail) payload.m6FinalBody = toBr(msg.m6BodyEmail);
  if (msg.m6BodyLi) payload.m6FinalBodyLI = msg.m6BodyLi;

  console.log("[launch] contact.assignee:", contact.assignee);
  console.log("[launch] payload:", JSON.stringify(payload, null, 2));

  const encoded = Buffer.from(`:${process.env.LEMLIST_API_KEY}`).toString("base64");
  const res = await fetch(
    `https://api.lemlist.com/api/campaigns/${campaignId}/leads/${encodeURIComponent(lemlistEmail)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const lemlistRaw = await res.text();
  if (!res.ok) {
    return NextResponse.json({ error: lemlistRaw }, { status: res.status });
  }

  // Parse lemlistLeadId from response + post Slack parent message
  let lemlistLeadId: string | undefined;
  try {
    const parsed = JSON.parse(lemlistRaw) as Record<string, unknown>;
    lemlistLeadId = parsed._id as string | undefined;
  } catch { /* non-critical */ }

  // Upsert CampaignLead first to get the DB id for the dashboard link
  let campaignLeadDbId: string | undefined;
  if (lemlistLeadId) {
    const upserted = await prisma.campaignLead.upsert({
      where: { lemlistLeadId },
      update: { campaignId, airtableContactId: contact.airtableId, assignedAt: new Date(), sequenceType: msg.sequenceType ?? "linkedin" },
      create: { lemlistLeadId, campaignId, airtableContactId: contact.airtableId, assignedAt: new Date(), sequenceType: msg.sequenceType ?? "linkedin" },
      select: { id: true },
    });
    campaignLeadDbId = upserted.id;
  }

  const launchWebhookUrl = process.env.N8N_LAUNCH_WEBHOOK_URL;
  if (launchWebhookUrl) {
    fetch(launchWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        airtableContactId: contact.airtableId,
        campaignId,
        campaignLeadId: campaignLeadDbId,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
