import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getAuthenticatedClient, createCalendarEvent } from "@/lib/google-calendar";

export const runtime = "nodejs";
export const maxDuration = 60;

const CommitSessionSchema = z.object({
  date: z.string(),
  durationMinutes: z.number(),
  focus: z.string(),
  start: z.string(),
  end: z.string(),
});

const CommitRequestSchema = z.object({
  assignmentId: z.string(),
  sessions: z.array(CommitSessionSchema).min(1),
});

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CommitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { assignmentId, sessions } = parsed.data;

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, userId: user.id },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
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

  let created = 0;
  let failed = 0;

  for (const session of sessions) {
    const start = new Date(session.start);
    const end = new Date(session.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      failed += 1;
      continue;
    }

    try {
      await createCalendarEvent(client, {
        summary: `Study: ${assignment.name}`,
        description: `${session.focus}\n\nScheduled by the backward-planning tool.`,
        start,
        end,
      });
      created += 1;
    } catch (error) {
      console.error("createCalendarEvent failed:", error);
      failed += 1;
    }
  }

  return NextResponse.json({ created, failed, total: sessions.length });
}
