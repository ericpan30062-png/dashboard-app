import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { ExtractedAssignmentSchema } from "@/lib/syllabus-schema";

export const runtime = "nodejs";

const ConfirmAssignmentsSchema = z.object({
  assignments: z.array(ExtractedAssignmentSchema).min(1),
});

export async function GET() {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ assignments: [] });
  }

  const assignments = await prisma.assignment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ConfirmAssignmentsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assignments payload" },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(
    parsed.data.assignments.map((a) =>
      prisma.assignment.create({
        data: {
          userId: user.id,
          name: a.name,
          dueDate: a.dueDate,
          weight: a.weight,
          type: a.type,
        },
      }),
    ),
  );

  return NextResponse.json({ assignments: created });
}
