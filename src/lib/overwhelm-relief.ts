import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";
import type { ScoredAssignment } from "@/lib/grade-impact";
import type { FreeBlock } from "@/lib/google-calendar";

const ReliefPlanSchema = z.object({
  task: z.string(),
  specificFocus: z.string(),
  durationMinutes: z.number(),
  encouragement: z.string(),
});

export type ReliefPlan = z.infer<typeof ReliefPlanSchema>;

export type ExamCountdown = {
  assignmentName: string;
  dueDate: string;
  scheduledSessionCount: number;
  nextSessionDate: string | null;
};

const SYSTEM_PROMPT = `A student just clicked an "I'm overwhelmed" button. Given their current situation — upcoming assignments with due dates and grade weights, their remaining free time today, and any study plans already in motion for exams — identify the single most important thing they should work on for the next 90 minutes.

Rules:
- The task title must be specific and actionable, never a vague category. "Outline the three main arguments for your history essay" is good. "Work on essay" or "Study" is not.
- specificFocus should clarify exactly what doing this session well looks like — what "done" is for this one sitting.
- durationMinutes should usually be 90, but shorten it if their remaining free time today is known and less than that. Never suggest more time than they actually have free today, when that's known. If free time today is unknown (calendar not connected), default to 90.
- encouragement must be exactly two sentences: honest and warm, not generic or hollow. Acknowledge the real difficulty without minimizing it, and ground it in something concrete about their actual situation — not empty platitudes like "you've got this!".
- If nothing is urgently due, help them use this time well anyway (get ahead on the highest-weight upcoming thing, review, or deliberately rest) rather than inventing false urgency.`;

function formatAssignments(scored: ScoredAssignment[]): string {
  if (scored.length === 0) return "(none — nothing incomplete with a known due date)";
  return scored
    .map(
      (s) =>
        `- ${s.assignment.name} (${s.assignment.type.toLowerCase()}, ${s.assignment.weight ?? "?"}% of grade, due in ${s.daysUntilDue} day${s.daysUntilDue === 1 ? "" : "s"})`,
    )
    .join("\n");
}

function formatFreeBlocks(blocks: FreeBlock[] | null): string {
  if (blocks === null) return "(unknown — Google Calendar isn't connected)";
  if (blocks.length === 0) return "(none — no free time left today)";
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return blocks.map((b) => `${fmt(b.start)}-${fmt(b.end)}`).join(", ");
}

function formatExamCountdowns(countdowns: ExamCountdown[]): string {
  if (countdowns.length === 0) return "(none currently scheduled)";
  return countdowns
    .map((c) =>
      c.scheduledSessionCount > 0
        ? `- ${c.assignmentName} (due ${c.dueDate}): ${c.scheduledSessionCount} study session(s) already on the calendar, next one ${c.nextSessionDate ?? "unknown"}`
        : `- ${c.assignmentName} (due ${c.dueDate}): no study sessions scheduled yet`,
    )
    .join("\n");
}

export async function getOverwhelmRelief(input: {
  assignments: ScoredAssignment[];
  todayFreeBlocks: FreeBlock[] | null;
  examCountdowns: ExamCountdown[];
}): Promise<ReliefPlan> {
  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Incomplete assignments (upcoming, not yet past due):
${formatAssignments(input.assignments)}

Remaining free time today: ${formatFreeBlocks(input.todayFreeBlocks)}

Active exam countdown plans:
${formatExamCountdowns(input.examCountdowns)}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ReliefPlanSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parseable relief plan");
  }

  return message.parsed_output;
}
