import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";

export const runtime = "nodejs";

const BodySchema = z.object({
  status: z.enum(["PROGRESS_MADE", "BLOCKED"]),
  blockedNote: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const session = await prisma.studySession.findFirst({
    where: { id, userId: user.id },
  });
  if (!session) {
    return NextResponse.json({ error: "Study session not found" }, { status: 404 });
  }

  const updated = await prisma.studySession.update({
    where: { id: session.id },
    data: {
      status: parsed.data.status,
      blockedNote:
        parsed.data.status === "BLOCKED" ? parsed.data.blockedNote || null : null,
    },
  });

  return NextResponse.json({ studySession: updated });
}
