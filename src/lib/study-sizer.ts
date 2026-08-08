import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { AssignmentType } from "@/generated/prisma/enums";

const TopicEstimateSchema = z.object({
  topic: z.string(),
  hours: z.number(),
});

const StudySizeEstimateSchema = z.object({
  totalHours: z.number(),
  topics: z.array(TopicEstimateSchema),
  confidenceLevel: z.enum(["low", "medium", "high"]),
  confidenceReasoning: z.string(),
});

export type StudySizeEstimate = z.infer<typeof StudySizeEstimateSchema>;

const SYSTEM_PROMPT = `You estimate how many hours a student will need to prepare for a graded assignment.

Given the assignment's name, type, grade weight, a list of topics it covers (if known), and how many weeks into the semester it falls, return:
- totalHours: your best estimate of total study/work hours needed
- topics: a hint-by-topic breakdown of hours (if topics were provided — split totalHours across them realistically, weighting harder or more heavily-tested topics more). If no topics were given, return an empty array and put your reasoning about the whole assignment in totalHours alone.
- confidenceLevel: "low", "medium", or "high" — how confident you are in this estimate given the information available (fewer topics/context = lower confidence)
- confidenceReasoning: one or two sentences explaining the confidence level and the estimate itself — be concrete (e.g. reference the grade weight, assignment type, or number of topics), not generic.

Grade weight and assignment type should meaningfully affect the estimate — a 30%-weighted final project warrants far more hours than a 5%-weighted homework set, and exams typically need more review/practice time than papers or homework of the same weight.`;

export async function getStudySizeEstimate(
  anthropic: Anthropic,
  input: {
    assignmentName: string;
    assignmentType: AssignmentType;
    weight: number | null;
    topics: string[];
    weeksSinceSemesterStart: number | null;
  },
): Promise<StudySizeEstimate> {
  const weeksText =
    input.weeksSinceSemesterStart !== null
      ? `${input.weeksSinceSemesterStart} weeks`
      : "unknown";

  const topicsText =
    input.topics.length > 0
      ? input.topics.map((t) => `- ${t}`).join("\n")
      : "(no topic list available)";

  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Assignment: ${input.assignmentName}
Type: ${input.assignmentType.toLowerCase()}
Grade weight: ${input.weight ?? "unknown"}%
Weeks since semester start: ${weeksText}

Topics to cover:
${topicsText}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(StudySizeEstimateSchema),
    },
  });

  if (!message.parsed_output) {
    throw new Error("Claude did not return a parseable study size estimate");
  }

  return message.parsed_output;
}
