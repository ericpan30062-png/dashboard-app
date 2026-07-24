import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";

export const runtime = "nodejs";

const BodySchema = z.object({
  assignmentId: z.string(),
  totalHours: z.number().min(0),
});

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: parsed.data.assignmentId, userId: user.id },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const updated = await prisma.assignment.update({
    where: { id: assignment.id },
    data: { estimatedHours: parsed.data.totalHours },
  });

  return NextResponse.json({ assignment: updated });
}
