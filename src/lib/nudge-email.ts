import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";
import type { AssignmentType } from "@/generated/prisma/enums";
import type { OfficeHours } from "@/generated/prisma/client";

const NudgeEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type NudgeEmail = z.infer<typeof NudgeEmailSchema>;

const SYSTEM_PROMPT = `You draft a short, professional email from a student to their professor or TA, asking to connect during office hours because the student is stuck on an assignment.

Rules:
- Keep it brief — a few sentences, not a wall of text.
- Reference the specific assignment by name and briefly what it's about.
- If a specific blocker/note is given, mention it concretely. If none is given, describe generally what they're likely stuck on based on the assignment's type and name — don't invent a fake specific technical problem.
- Reference the specific office hours day/time/location given, and ask if that works or how else to connect.
- Tone: professional but warm, not stiff. Sign off with just "[Your name]" as a placeholder.
- subject: short and clear (e.g. "Question about [Assignment] — office hours?").`;

export async function draftNudgeEmail(input: {
  assignmentName: string;
  assignmentType: AssignmentType;
  course: string;
  instructorName: string;
  blockedNote: string | null;
  slot: Pick<OfficeHours, "dayOfWeek" | "startTime" | "endTime" | "location">;
}): Promise<NudgeEmail> {
  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assignment: ${input.assignmentName} (${input.assignmentType.toLowerCase()})
Course: ${input.course}
Instructor: ${input.instructorName}
What's blocking the student: ${input.blockedNote ?? "(not specified — describe generally based on the assignment)"}

Office hours being referenced: ${input.slot.dayOfWeek}, ${input.slot.startTime}-${input.slot.endTime}, ${input.slot.location}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(NudgeEmailSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parseable email draft");
  }

  return message.parsed_output;
}
