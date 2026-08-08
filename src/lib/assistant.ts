import type Anthropic from "@anthropic-ai/sdk";
import type { Assignment } from "@/generated/prisma/client";
import type { CalendarEvent } from "@/lib/google-calendar";
import type { CanvasCourse } from "@/lib/canvas";
import type { Note } from "@/lib/notion";
import { parseDueDate, daysUntil } from "@/lib/grade-impact";

const NOTE_BODY_PREVIEW_CHARS = 300;

const SYSTEM_PROMPT = `You are a study-planning assistant answering one question from a student, using only the context given below (their assignments, and — if connected — their calendar, Canvas courses, and Notion notes).

Rules:
- Be concrete: reference actual assignment names, due dates, grade weights, course names, event times, or note titles from the context rather than speaking generally.
- If the context doesn't contain enough information to answer, say so plainly rather than guessing or inventing details.
- Keep the answer focused and no longer than necessary — a few sentences for a simple question, more only if the question genuinely needs it.
- Don't repeat the question back or add unnecessary preamble like "Based on the context provided" — just answer.`;

function formatAssignments(assignments: Assignment[], now: Date): string {
  if (assignments.length === 0) return "(none)";
  return assignments
    .map((a) => {
      const dueDate = parseDueDate(a.dueDate);
      const dueText = dueDate
        ? `due ${a.dueDate} (${daysUntil(dueDate, now)} day(s) from now)`
        : `due date: ${a.dueDate ?? "unknown"}`;
      const weightText = a.weight != null ? `${a.weight}% of grade` : "weight unknown";
      const hoursText = a.estimatedHours != null ? `, est. ${a.estimatedHours}h` : "";
      return `- ${a.name} (${a.type.toLowerCase()}${a.course ? `, ${a.course}` : ""}): ${weightText}, ${dueText}${hoursText}`;
    })
    .join("\n");
}

function formatEvents(events: CalendarEvent[] | null): string {
  if (events === null) return "(not connected)";
  if (events.length === 0) return "(no events in the next 7 days)";
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return events.map((e) => `- ${e.summary}: ${fmt(e.start)} - ${fmt(e.end)}`).join("\n");
}

function formatCourses(courses: CanvasCourse[] | null): string {
  if (courses === null) return "(not connected)";
  if (courses.length === 0) return "(no active courses found)";
  return courses.map((c) => `- ${c.name}`).join("\n");
}

function formatNotes(notes: Note[] | null): string {
  if (notes === null) return "(not connected)";
  if (notes.length === 0) return "(no notes yet)";
  return notes
    .map((n) => {
      const preview =
        n.body.length > NOTE_BODY_PREVIEW_CHARS
          ? `${n.body.slice(0, NOTE_BODY_PREVIEW_CHARS)}...`
          : n.body;
      return `- "${n.title}": ${preview || "(empty)"}`;
    })
    .join("\n");
}

export async function answerAssistantQuestion(
  anthropic: Anthropic,
  input: {
    question: string;
    assignments: Assignment[];
    events: CalendarEvent[] | null;
    courses: CanvasCourse[] | null;
    notes: Note[] | null;
  },
): Promise<string> {
  const now = new Date();

  const message = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assignments:
${formatAssignments(input.assignments, now)}

Calendar events (next 7 days):
${formatEvents(input.events)}

Canvas courses:
${formatCourses(input.courses)}

Notes:
${formatNotes(input.notes)}

Question: ${input.question}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error("Claude did not return a text answer");
  }

  return textBlock.text.trim();
}
