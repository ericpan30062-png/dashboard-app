import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { parseDueDate, daysUntil } from "@/lib/grade-impact";
import {
  getAuthenticatedClient,
  listBusyIntervals,
  computeFreeBlocks,
} from "@/lib/google-calendar";
import { generateStudyPlan, assignStartTimes } from "@/lib/study-plan";
import { getAnthropicClientForUser } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const GenerateRequestSchema = z.object({
  assignmentId: z.string(),
  hoursEstimate: z.number().min(0.25).max(200),
});

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { assignmentId, hoursEstimate } = parsed.data;

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, userId: user.id },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const dueDate = parseDueDate(assignment.dueDate);
  if (!dueDate) {
    return NextResponse.json(
      {
        error:
          "This assignment doesn't have a specific due date. Edit it to add one (e.g. 2026-08-01) before planning.",
      },
      { status: 400 },
    );
  }

  const now = new Date();
  if (daysUntil(dueDate, now) < 0) {
    return NextResponse.json(
      { error: "This assignment's due date has already passed." },
      { status: 400 },
    );
  }

  const anthropicClient = await getAnthropicClientForUser(user.id);
  if (!anthropicClient) {
    return NextResponse.json(
      { error: "Connect your Anthropic API key on Settings first.", needsAnthropicConnect: true },
      { status: 400 },
    );
  }

  const client = await getAuthenticatedClient(user.id);
  if (!client) {
    return NextResponse.json(
      {
        error: "Connect Google Calendar first (Calendar page in the sidebar).",
        needsGoogleConnect: true,
      },
      { status: 400 },
    );
  }

  const endOfDueDate = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate() + 1,
  );

  let busy;
  try {
    busy = await listBusyIntervals(client, now, endOfDueDate);
  } catch (error) {
    console.error("listBusyIntervals failed:", error);
    return NextResponse.json(
      { error: "Couldn't read your Google Calendar events." },
      { status: 502 },
    );
  }

  const freeBlocks = computeFreeBlocks(busy, now, dueDate);
  if (freeBlocks.length === 0) {
    return NextResponse.json(
      {
        error:
          "No free time found between now and the due date — your calendar looks fully booked.",
      },
      { status: 400 },
    );
  }

  const sessions = await generateStudyPlan(anthropicClient, {
    assignmentName: assignment.name,
    assignmentType: assignment.type,
    dueDate,
    hoursEstimate,
    freeBlocks,
  });
  if (sessions.length === 0) {
    return NextResponse.json(
      { error: "Couldn't generate a study plan — try again." },
      { status: 502 },
    );
  }

  const scheduled = assignStartTimes(sessions, freeBlocks);

  return NextResponse.json({
    sessions: scheduled.map((s) => ({
      date: s.date,
      durationMinutes: s.durationMinutes,
      focus: s.focus,
      schedulable: s.schedulable,
      start: s.start?.toISOString() ?? null,
      end: s.end?.toISOString() ?? null,
    })),
  });
}
