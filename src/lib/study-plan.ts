import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";
import { dateKey, type FreeBlock } from "@/lib/google-calendar";
import type { AssignmentType } from "@/generated/prisma/enums";

export const StudySessionSchema = z.object({
  date: z.string(), // YYYY-MM-DD — must be one of the dates offered in freeBlocks
  durationMinutes: z.number(),
  focus: z.string(),
});

const StudyPlanSchema = z.object({ sessions: z.array(StudySessionSchema) });

export type PlanSession = z.infer<typeof StudySessionSchema>;

export type ScheduledSession = PlanSession & {
  start: Date | null;
  end: Date | null;
  schedulable: boolean;
};

const SYSTEM_PROMPT = `You are a study-planning assistant. You'll be given an assignment (name, type, due date), a rough time estimate for how long it'll take, and the student's actual free time blocks between now and the due date (existing calendar commitments have already been excluded).

Create a day-by-day study plan as a list of study sessions. Rules:
- Only use dates that appear in the free-block list, and never schedule more total minutes on a date than that date's free block(s) can hold.
- Distribute the estimated time using spaced practice rather than cramming into one day, when the runway allows it — but weight sessions closer to the deadline more heavily for exam prep (review/practice), and keep steady incremental progress for papers/projects/homework.
- Each session's durationMinutes should be a realistic single sitting (roughly 30-180 minutes).
- The total of all session durations should be close to the time estimate, but must never exceed the free time actually available.
- "focus" must be a specific, actionable goal for that session (e.g. "Draft the introduction and outline body paragraphs", "Redo practice problems 1-15 from chapter 4"), never a generic label like "study" or "work on assignment".`;

function formatFreeBlocksByDate(freeBlocks: FreeBlock[]): string {
  const byDate = new Map<string, FreeBlock[]>();
  for (const block of freeBlocks) {
    const list = byDate.get(block.date) ?? [];
    list.push(block);
    byDate.set(block.date, list);
  }

  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

  return [...byDate.entries()]
    .map(([date, blocks]) => {
      const parts = blocks.map((b) => `${fmt(b.start)}-${fmt(b.end)}`).join(", ");
      const totalMinutes = blocks.reduce(
        (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 60_000,
        0,
      );
      return `- ${date}: ${parts} (${Math.round(totalMinutes)} min free)`;
    })
    .join("\n");
}

export async function generateStudyPlan(params: {
  assignmentName: string;
  assignmentType: AssignmentType;
  dueDate: Date;
  hoursEstimate: number;
  freeBlocks: FreeBlock[];
}): Promise<PlanSession[]> {
  if (params.freeBlocks.length === 0) return [];

  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assignment: ${params.assignmentName} (${params.assignmentType.toLowerCase()})
Due date: ${dateKey(params.dueDate)}
Time estimate: ${params.hoursEstimate} hours

Available free blocks:
${formatFreeBlocksByDate(params.freeBlocks)}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(StudyPlanSchema),
    },
  });

  return message.parsed_output?.sessions ?? [];
}

// Deterministically converts Claude's {date, durationMinutes, focus} sessions
// into concrete start/end times by walking each date's free blocks in order
// and consuming time as sessions are placed. This is done in code rather
// than trusted to the model so a session can never end up double-booked or
// scheduled outside real free time, even if Claude's own arithmetic is off.
export function assignStartTimes(
  sessions: PlanSession[],
  freeBlocks: FreeBlock[],
): ScheduledSession[] {
  const blocksByDate = new Map<string, { start: Date; end: Date }[]>();
  for (const block of freeBlocks) {
    const list = blocksByDate.get(block.date) ?? [];
    list.push({ start: block.start, end: block.end });
    blocksByDate.set(block.date, list);
  }
  for (const list of blocksByDate.values()) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  return sessions.map((session) => {
    const dayBlocks = blocksByDate.get(session.date);
    if (!dayBlocks) {
      return { ...session, start: null, end: null, schedulable: false };
    }

    const neededMs = session.durationMinutes * 60_000;

    for (const block of dayBlocks) {
      const availableMs = block.end.getTime() - block.start.getTime();
      if (availableMs >= neededMs) {
        const start = block.start;
        const end = new Date(start.getTime() + neededMs);
        block.start = end; // consume this slice for subsequent sessions
        return { ...session, start, end, schedulable: true };
      }
    }

    // No single block had enough room for the full request — use the
    // largest remaining block and trim the session to fit it, so at least
    // some study time gets scheduled instead of none.
    let largest: { start: Date; end: Date } | null = null;
    for (const block of dayBlocks) {
      const size = block.end.getTime() - block.start.getTime();
      const largestSize = largest ? largest.end.getTime() - largest.start.getTime() : 0;
      if (size > largestSize) largest = block;
    }

    const MIN_TRIMMED_MINUTES = 10;
    if (
      largest &&
      largest.end.getTime() - largest.start.getTime() >= MIN_TRIMMED_MINUTES * 60_000
    ) {
      const { start, end } = largest;
      largest.start = largest.end; // fully consumed
      return {
        ...session,
        durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
        start,
        end,
        schedulable: true,
      };
    }

    return { ...session, start: null, end: null, schedulable: false };
  });
}
