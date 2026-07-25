import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";

export const runtime = "nodejs";

const BodySchema = z.object({ completed: z.boolean() });

export async function PATCH(
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

  // Ownership check via topic -> day -> plan -> userId, in one query, and
  // reused below to recompute coverage without a second round trip.
  const topic = await prisma.examPlanTopic.findFirst({
    where: { id, examPlanDay: { examPlan: { userId: user.id } } },
    include: {
      examPlanDay: {
        include: { examPlan: { include: { days: { include: { topics: true } } } } },
      },
    },
  });
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const updated = await prisma.examPlanTopic.update({
    where: { id },
    data: { completed: parsed.data.completed },
  });

  const allTopics = topic.examPlanDay.examPlan.days.flatMap((d) => d.topics);
  const totalTopics = allTopics.length;
  const completedTopics = allTopics.filter((t) =>
    t.id === id ? parsed.data.completed : t.completed,
  ).length;

  return NextResponse.json({
    topic: updated,
    coverage: {
      totalTopics,
      completedTopics,
      remainingTopics: totalTopics - completedTopics,
      percentComplete:
        totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100),
    },
  });
}
