import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { scoreUpcomingAssignments } from "@/lib/grade-impact";
import {
  getAuthenticatedClient,
  listCalendarEvents,
  computeFreeBlocks,
  dateKey,
  type FreeBlock,
} from "@/lib/google-calendar";
import { getOverwhelmRelief, type ExamCountdown } from "@/lib/overwhelm-relief";
import { getAnthropicClientForUser } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const assignments = await prisma.assignment.findMany({ where: { userId: user.id } });
  const now = new Date();
  // "Incomplete" — assignments don't track a completed flag yet, so this
  // treats "upcoming" (not yet past due) as the incomplete set, same as the
  // priorities and crunch-predictor pages.
  const { scored } = scoreUpcomingAssignments(assignments, now);

  const anthropicClient = await getAnthropicClientForUser(user.id);
  if (!anthropicClient) {
    return NextResponse.json(
      { error: "Connect your Anthropic API key on Settings first.", needsAnthropicConnect: true },
      { status: 400 },
    );
  }

  const client = await getAuthenticatedClient(user.id);

  let todayFreeBlocks: FreeBlock[] | null = null;
  let examCountdowns: ExamCountdown[] = [];

  if (client) {
    try {
      const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
      const events = await listCalendarEvents(client, now, horizon);

      const busyToday = events.filter((e) => !e.transparent).map(({ start, end }) => ({ start, end }));
      todayFreeBlocks = computeFreeBlocks(busyToday, now, now);

      examCountdowns = scored
        .filter((s) => s.assignment.type === "EXAM")
        .map((s) => {
          const sessions = events
            .filter((e) => e.summary === `Study: ${s.assignment.name}` && e.start >= now)
            .sort((a, b) => a.start.getTime() - b.start.getTime());

          return {
            assignmentName: s.assignment.name,
            dueDate: s.assignment.dueDate ?? "",
            scheduledSessionCount: sessions.length,
            nextSessionDate: sessions[0] ? dateKey(sessions[0].start) : null,
          };
        });
    } catch (error) {
      // Don't fail the whole request over a calendar hiccup — the relief
      // plan can still be based on assignments alone.
      console.error("Overwhelm relief: calendar fetch failed:", error);
    }
  }

  try {
    const relief = await getOverwhelmRelief(anthropicClient, {
      assignments: scored,
      todayFreeBlocks,
      examCountdowns,
    });
    return NextResponse.json(relief);
  } catch (error) {
    console.error("getOverwhelmRelief failed:", error);
    return NextResponse.json(
      { error: "Couldn't figure out what to focus on right now — try again." },
      { status: 502 },
    );
  }
}
