import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getCanvasCredentials, listCourseModuleTopics } from "@/lib/canvas";
import { getStudySizeEstimate } from "@/lib/study-sizer";
import { getAnthropicClientForUser } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  assignmentId: z.string(),
  canvasCourseId: z.string().nullable().optional(),
});

function weeksSince(start: Date, now: Date): number {
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / msPerWeek));
}

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

  // If a course was just picked for this assignment (or it differs from
  // what's stored), persist it so future re-estimates don't need it again.
  const canvasCourseId = parsed.data.canvasCourseId ?? assignment.canvasCourseId ?? null;
  if (canvasCourseId && canvasCourseId !== assignment.canvasCourseId) {
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { canvasCourseId },
    });
  }

  let topics: string[] = [];
  if (canvasCourseId) {
    const creds = await getCanvasCredentials(user.id);
    if (creds) {
      try {
        topics = await listCourseModuleTopics(creds, canvasCourseId);
      } catch (error) {
        console.error("listCourseModuleTopics failed:", error);
        // Proceed without topics rather than failing the whole estimate.
      }
    }
  }

  const weeksSinceSemesterStart = user.semesterStartDate
    ? weeksSince(user.semesterStartDate, new Date())
    : null;

  const anthropicClient = await getAnthropicClientForUser(user.id);
  if (!anthropicClient) {
    return NextResponse.json(
      { error: "Connect your Anthropic API key on Settings first.", needsAnthropicConnect: true },
      { status: 400 },
    );
  }

  try {
    const estimate = await getStudySizeEstimate(anthropicClient, {
      assignmentName: assignment.name,
      assignmentType: assignment.type,
      weight: assignment.weight,
      topics,
      weeksSinceSemesterStart,
    });
    return NextResponse.json(estimate);
  } catch (error) {
    console.error("getStudySizeEstimate failed:", error);
    return NextResponse.json(
      { error: "Couldn't generate an estimate — try again." },
      { status: 502 },
    );
  }
}
