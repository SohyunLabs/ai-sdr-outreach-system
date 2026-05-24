import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ airtableId: string }> }
) {
  const { airtableId } = await params;
  const body = await req.json();

  // DB 업데이트
  await prisma.message.updateMany({
    where: { contactId: airtableId },
    data: {
      m1Subject: body.m1Subject ?? undefined,
      m1BodyEmail: body.m1BodyEmail ?? undefined,
      m1BodyLi: body.m1BodyLi ?? undefined,
      m2Subject: body.m2Subject ?? undefined,
      m2BodyEmail: body.m2BodyEmail ?? undefined,
      m2BodyLi: body.m2BodyLi ?? undefined,
      m3Subject: body.m3Subject ?? undefined,
      m3BodyEmail: body.m3BodyEmail ?? undefined,
      m3BodyLi: body.m3BodyLi ?? undefined,
      m4LiConnReq: body.m4LiConnReq ?? undefined,
      m5LiChat: body.m5LiChat ?? undefined,
      m6Subject: body.m6Subject ?? undefined,
      m6BodyEmail: body.m6BodyEmail ?? undefined,
      m6BodyLi: body.m6BodyLi ?? undefined,
    },
  });

  // 메시지 편집 시 연관 리드 dirty 표시
  await prisma.campaignLead.updateMany({
    where: { airtableContactId: airtableId },
    data: { isLemlistDirty: true },
  });

  return NextResponse.json({ ok: true });
}
