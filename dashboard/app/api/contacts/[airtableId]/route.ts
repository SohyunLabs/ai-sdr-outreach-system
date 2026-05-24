import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ airtableId: string }> }
) {
  const { airtableId } = await params;
  const body = await req.json();

  await prisma.contact.update({
    where: { airtableId },
    data: {
      email: body.email ?? undefined,
      linkedinUrl: body.linkedinUrl ?? undefined,
    },
  });

  // 이 컨택트와 연결된 모든 리드를 dirty로 표시
  await prisma.campaignLead.updateMany({
    where: { airtableContactId: airtableId },
    data: { isLemlistDirty: true },
  });

  return NextResponse.json({ ok: true });
}
