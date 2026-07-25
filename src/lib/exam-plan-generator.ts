import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";

const ExamPlanDaySchema = z.object({
  date: z.string(), // "YYYY-MM-DD"
  topics: z.array(z.string()),
  estimatedDurationMinutes: z.number(),
});

const ExamPlanSchema = z.object({
  days: z.array(ExamPlanDaySchema),
});

export type ExamPlanDay = z.infer<typeof ExamPlanDaySchema>;

const SYSTEM_PROMPT = `You build a day-by-day countdown study plan for an upcoming exam.

Given the exam name, the topics/modules it covers (if known), how many days remain, and the student's actual available study time for each of those days, produce one entry per day with:
- date: "YYYY-MM-DD", must be one of the dates given in the available-time list
- topics: a short list of specific topics to cover that day (not "study" or "review everything") — pull from the given topic list when one is provided, splitting broad topics into smaller specific ones if there are few topics but many days
- estimatedDurationMinutes: realistic for that day — never exceed that day's available hours, and even when more time is technically free, don't schedule more than a sane amount of focused study in one day (roughly 60-240 minutes depending on how many days remain and how much there is to cover)

Rules:
- Cover every topic given by the exam date — don't leave topics for "later" if there is no later.
- Spread topics so review/practice is weighted more heavily in the final day or two rather than cramming new material right before the exam.
- If no topic list was given, use general but still specific study activities based on the exam's name (e.g. "Redo practice problems from the hardest homework sets", not just "study").
- Skip a date entirely if there's truly nothing productive to assign (e.g. zero available hours that day) rather than forcing an empty or padded entry.`;

export async function generateExamPlan(input: {
  examName: string;
  course: string | null;
  topics: string[];
  daysUntilExam: number;
  availableTimePerDay: { date: string; hours: number }[];
}): Promise<ExamPlanDay[]> {
  const topicsText =
    input.topics.length > 0
      ? input.topics.map((t) => `- ${t}`).join("\n")
      : "(no topic list available)";

  const availabilityText = input.availableTimePerDay
    .map((d) => `- ${d.date}: ${d.hours.toFixed(1)}h available`)
    .join("\n");

  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Exam: ${input.examName}${input.course ? ` (${input.course})` : ""}
Days until exam: ${input.daysUntilExam}

Topics/modules covered:
${topicsText}

Available study time per day:
${availabilityText}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(ExamPlanSchema),
    },
  });

  return message.parsed_output?.days ?? [];
}
