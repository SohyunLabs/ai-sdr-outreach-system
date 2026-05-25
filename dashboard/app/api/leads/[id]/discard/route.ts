import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchLeadFromCampaign } from "@/lib/lemlist";

const LEMLIST_TO_DB: Record<string, string[]> = {
  m1InitialSubject:      ["m1Subject"],
  m1InitialBody:         ["m1BodyEmail", "m1BodyLi"],
  m2FU1EmailOpenSubject: ["m2Subject"],
  m2FU1EmailOpenBody:    ["m2BodyEmail", "m2BodyLi"],
  m3FU1EmailCloseSubject:["m3Subject"],
  m3FU1EmailCloseBody:   ["m3BodyEmail", "m3BodyLi"],
  m4LIConnReqBody:       ["m4LiConnReq"],
  m5LIChatBody:          ["m5LiChat"],
  m6FinalSubject:        ["m6Subject"],
  m6FinalBody:           ["m6BodyEmail", "m6BodyLi"],
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lead = await prisma.campaignLead.findUnique({
    where: { id },
    include: { contact: { include: { messages: true } } },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.contact) return NextResponse.json({ error: "No linked contact" }, { status: 400 });

  // Fetch lead data from CSV export using _id (lea_XXXX)
  const lemlistLead = await fetchLeadFromCampaign(lead.campaignId, lead.lemlistLeadId);

  // 1. Restore contact (email, linkedinUrl, company, role)
  const nameParts = [lemlistLead.firstName, lemlistLead.lastName].filter(Boolean).join(" ");
  await prisma.contact.update({
    where: { airtableId: lead.contact.airtableId },
    data: {
      ...(nameParts && { name: nameParts }),
      ...(lemlistLead.email !== undefined && { email: lemlistLead.email || null }),
      ...(lemlistLead.linkedinUrl !== undefined && { linkedinUrl: lemlistLead.linkedinUrl || null }),
      ...(lemlistLead.companyName !== undefined && { company: lemlistLead.companyName || null }),
      ...(lemlistLead.jobTitle !== undefined && { role: lemlistLead.jobTitle || null }),
    },
  });

  // 2. Restore message
  const msg = lead.contact.messages[0];
  if (msg) {
    const msgUpdate: Record<string, string | null> = {};
    for (const [lemKey, dbKeys] of Object.entries(LEMLIST_TO_DB)) {
      const val = lemlistLead[lemKey] ?? null;
      for (const dbKey of dbKeys) {
        msgUpdate[dbKey] = val;
      }
    }
    await prisma.message.update({ where: { id: msg.id }, data: msgUpdate });
  }

  // 3. Restore state -- apply lastState from platform lead if available
  const restoredState = lemlistLead.lastState ?? null;

  // 4. Reset dirty flag
  await prisma.campaignLead.update({
    where: { id },
    data: {
      ...(restoredState !== null && { state: restoredState }),
      isLemlistDirty: false,
    },
  });

  return NextResponse.json({ ok: true });
}
