import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getAnthropicClientForUser } from "@/lib/anthropic";
import { getAuthenticatedClient, listCalendarEvents, type CalendarEvent } from "@/lib/google-calendar";
import { getCanvasCredentials, listCanvasCourses, type CanvasCourse } from "@/lib/canvas";
import { getNotionCredentials, listNotes, type Note } from "@/lib/notion";
import { answerAssistantQuestion } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 30;

const NOTES_LIMIT = 20;

const AskSchema = z.object({
  question: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const anthropicClient = await getAnthropicClientForUser(user.id);
  if (!anthropicClient) {
    return NextResponse.json(
      { error: "Connect your Anthropic API key on Settings first.", needsAnthropicConnect: true },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const assignments = await prisma.assignment.findMany({ where: { userId: user.id } });

  let events: CalendarEvent[] | null = null;
  const googleClient = await getAuthenticatedClient(user.id);
  if (googleClient) {
    try {
      const now = new Date();
      const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      events = await listCalendarEvents(googleClient, now, horizon);
    } catch (error) {
      console.error("Assistant: listCalendarEvents failed:", error);
    }
  }

  let courses: CanvasCourse[] | null = null;
  const canvasCreds = await getCanvasCredentials(user.id);
  if (canvasCreds) {
    try {
      courses = await listCanvasCourses(canvasCreds);
    } catch (error) {
      console.error("Assistant: listCanvasCourses failed:", error);
    }
  }

  let notes: Note[] | null = null;
  const notionCreds = await getNotionCredentials(user.id);
  if (notionCreds) {
    try {
      notes = (await listNotes(notionCreds)).slice(0, NOTES_LIMIT);
    } catch (error) {
      console.error("Assistant: listNotes failed:", error);
    }
  }

  try {
    const answer = await answerAssistantQuestion(anthropicClient, {
      question: parsed.data.question,
      assignments,
      events,
      courses,
      notes,
    });
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("answerAssistantQuestion failed:", error);
    return NextResponse.json(
      { error: "Couldn't get an answer — try again." },
      { status: 502 },
    );
  }
}
