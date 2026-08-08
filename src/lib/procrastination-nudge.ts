import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { AssignmentType } from "@/generated/prisma/enums";

const NudgeMessageSchema = z.object({
  message: z.string(),
});

const SYSTEM_PROMPT = `You write a single short, direct nudge message to a student about one specific assignment they've been avoiding.

Rules:
- 2-3 sentences, no more.
- Be honest and direct, not shaming or guilt-tripping — the goal is to snap them into action, not make them feel bad.
- Name the assignment and why it's urgent (due date, how long it's been sitting untouched, grade weight if it's meaningful) rather than being vague.
- End with a concrete, small next step they could take right now — not "you should really get started," something specific like "even 20 minutes of outlining would break the ice."
- No greeting, no sign-off, no subject line — just the message body.`;

export async function generateProcrastinationNudge(
  anthropic: Anthropic,
  input: {
    assignmentName: string;
    assignmentType: AssignmentType;
    course: string | null;
    daysUntilDue: number;
    daysAvoided: number;
    weight: number | null;
  },
): Promise<string> {
  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assignment: ${input.assignmentName} (${input.assignmentType.toLowerCase()})${input.course ? `, ${input.course}` : ""}
Due in: ${input.daysUntilDue} day(s)
Sitting untouched for: ${input.daysAvoided} day(s) (created but no study sessions scheduled)
Grade weight: ${input.weight !== null ? `${input.weight}%` : "unknown"}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(NudgeMessageSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parseable nudge message");
  }

  return message.parsed_output.message;
}
