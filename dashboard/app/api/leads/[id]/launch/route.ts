import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateLeadInfo, updateLeadVariables, resumeLead } from "@/lib/lemlist";

const DB_TO_LEMLIST: Record<string, string> = {
  m1Subject: "m1InitialSubject",
  m1BodyEmail: "m1InitialBody",
  m1BodyLi: "m1InitialBody",
  m2Subject: "m2FU1EmailOpenSubject",
  m2BodyEmail: "m2FU1EmailOpenBody",
  m2BodyLi: "m2FU1EmailOpenBody",
  m3Subject: "m3FU1EmailCloseSubject",
  m3BodyEmail: "m3FU1EmailCloseBody",
  m3BodyLi: "m3FU1EmailCloseBody",
  m4LiConnReq: "m4LIConnReqBody",
  m5LiChat: "m5LIChatBody",
  m6Subject: "m6FinalSubject",
  m6BodyEmail: "m6FinalBody",
  m6BodyLi: "m6FinalBody",
};

const EMAIL_BODY_KEYS = new Set(["m1BodyEmail", "m2BodyEmail", "m3BodyEmail", "m6BodyEmail"]);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const lead = await prisma.campaignLead.findUnique({
    where: { id },
    include: { contact: { include: { messages: true } } },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!lead.contact) {
    return NextResponse.json({ error: "No linked contact" }, { status: 400 });
  }

  const lemlistLeadId = lead.lemlistLeadId;
  if (!lemlistLeadId) {
    return NextResponse.json({ error: "No platform lead ID" }, { status: 400 });
  }

  const contact = lead.contact;
  const errors: string[] = [];

  // 1. Background info sync
  const nameParts = (contact.name ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  try {
    await updateLeadInfo(lead.campaignId, lemlistLeadId, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      companyName: contact.company ?? undefined,
      jobTitle: contact.role ?? undefined,
    });
  } catch (e) {
    errors.push(`Background info: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Message sequence sync
  const msg = contact.messages[0];
  if (msg) {
    const lemlistVars: Record<string, string> = {};
    for (const [dbKey, lemlistKey] of Object.entries(DB_TO_LEMLIST)) {
      if (EMAIL_BODY_KEYS.has(dbKey)) continue;
      const value = (msg as Record<string, unknown>)[dbKey];
      if (typeof value === "string" && value.trim() !== "") {
        lemlistVars[lemlistKey] = value;
      }
    }
    for (const [dbKey, lemlistKey] of Object.entries(DB_TO_LEMLIST)) {
      if (!EMAIL_BODY_KEYS.has(dbKey)) continue;
      const value = (msg as Record<string, unknown>)[dbKey];
      if (typeof value === "string" && value.trim() !== "") {
        lemlistVars[lemlistKey] = value.replace(/\n/g, "<br>");
      }
    }
    if (Object.keys(lemlistVars).length > 0) {
      try {
        await updateLeadVariables(lemlistLeadId, lemlistVars);
      } catch (e) {
        errors.push(`Message sequence: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 3. Launch lead on platform (unpause)
  let launchResult: { isPaused: boolean } | null = null;
  try {
    launchResult = await resumeLead(lemlistLeadId, lead.campaignId);
    if (launchResult.isPaused) {
      errors.push("Launch: Platform responded with isPaused=true -- lead was not started. Please check the platform directly.");
    }
  } catch (e) {
    errors.push(`Launch: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Sync complete -> reset dirty flag + update state
  if (errors.length === 0) {
    await prisma.campaignLead.update({
      where: { id },
      data: { isLemlistDirty: false, state: "launching" },
    });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    isPaused: launchResult?.isPaused,
  });
}
