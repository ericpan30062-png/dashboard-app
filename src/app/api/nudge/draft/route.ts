import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { isAssignmentStuck } from "@/lib/stuck-detector";
import { getAuthenticatedClient, listBusyIntervals } from "@/lib/google-calendar";
import { findNextNonConflictingSlot } from "@/lib/office-hours-matcher";
import { draftNudgeEmail } from "@/lib/nudge-email";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({ assignmentId: z.string() });

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

  const sessions = await prisma.studySession.findMany({
    where: { assignmentId: assignment.id },
  });
  const stuck = isAssignmentStuck(sessions);
  if (!stuck.stuck) {
    return NextResponse.json(
      { error: "This assignment isn't flagged as stuck." },
      { status: 400 },
    );
  }

  if (!assignment.course) {
    return NextResponse.json(
      {
        error:
          "This assignment has no course set, so we can't match it to office hours.",
      },
      { status: 400 },
    );
  }

  const entries = await prisma.officeHours.findMany({
    where: { userId: user.id, course: { equals: assignment.course, mode: "insensitive" } },
  });
  if (entries.length === 0) {
    return NextResponse.json(
      {
        error: `No office hours found for ${assignment.course}. Add some on the Office Hours page.`,
      },
      { status: 400 },
    );
  }

  const now = new Date();
  let busy: Awaited<ReturnType<typeof listBusyIntervals>> = [];
  const client = await getAuthenticatedClient(user.id);
  if (client) {
    try {
      const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 35);
      busy = await listBusyIntervals(client, now, horizon);
    } catch (error) {
      console.error("Nudge draft: listBusyIntervals failed:", error);
      // Proceed without conflict-checking rather than failing outright.
    }
  }

  const matched = findNextNonConflictingSlot(entries, busy, now);
  if (!matched) {
    return NextResponse.json(
      {
        error: `Couldn't find a free upcoming slot for ${assignment.course}'s office hours in the next few weeks.`,
      },
      { status: 400 },
    );
  }

  try {
    const draft = await draftNudgeEmail({
      assignmentName: assignment.name,
      assignmentType: assignment.type,
      course: assignment.course,
      instructorName: matched.officeHours.instructorName,
      blockedNote: stuck.session?.blockedNote ?? null,
      slot: matched.officeHours,
    });

    return NextResponse.json({
      subject: draft.subject,
      body: draft.body,
      to: matched.officeHours.instructorEmail ?? "",
      slot: {
        dayOfWeek: matched.officeHours.dayOfWeek,
        startTime: matched.officeHours.startTime,
        endTime: matched.officeHours.endTime,
        location: matched.officeHours.location,
        date: matched.start.toISOString(),
      },
      stuckReason: stuck.reason,
    });
  } catch (error) {
    console.error("draftNudgeEmail failed:", error);
    return NextResponse.json(
      { error: "Couldn't draft an email — try again." },
      { status: 502 },
    );
  }
}
