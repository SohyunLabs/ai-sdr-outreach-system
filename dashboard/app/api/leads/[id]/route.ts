import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  await prisma.campaignLead.update({
    where: { id },
    data: {
      state: body.state ?? undefined,
      isLemlistDirty: true,
    },
  });

  return NextResponse.json({ ok: true });
}
