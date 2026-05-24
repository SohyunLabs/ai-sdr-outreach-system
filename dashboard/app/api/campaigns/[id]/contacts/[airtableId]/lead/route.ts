import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; airtableId: string }> }
) {
  const { id: campaignId, airtableId } = await params;

  const lead = await prisma.campaignLead.findFirst({
    where: { campaignId, airtableContactId: airtableId },
    select: { id: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ id: lead.id });
}
