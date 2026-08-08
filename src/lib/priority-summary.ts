import type Anthropic from "@anthropic-ai/sdk";
import type { ScoredAssignment } from "@/lib/grade-impact";

const SYSTEM_PROMPT = `You are a study-planning assistant. You'll be given a student's upcoming assignments, already ranked by "impact score" (grade weight x an urgency multiplier based on how soon it's due).

Write exactly two sentences telling the student where to focus this week and why. Reference specific assignment names and their grade weight percentages. Be concrete and direct — no preamble, no bullet points, no headers.`;

function formatAssignmentLine(item: ScoredAssignment): string {
  const { assignment, daysUntilDue, impactScore } = item;
  const weightText =
    assignment.weight != null ? `${assignment.weight}% of grade` : "weight unknown";
  const dueText =
    daysUntilDue === 0
      ? "due today"
      : daysUntilDue === 1
        ? "due tomorrow"
        : `due in ${daysUntilDue} days`;

  return `- ${assignment.name} (${assignment.type.toLowerCase()}): ${weightText}, ${dueText}, impact score ${impactScore.toFixed(1)}`;
}

// Returns null (rather than throwing) on any failure — e.g. an invalid
// Anthropic key — so a page render never breaks just because this
// nice-to-have summary couldn't be generated.
export async function getFocusSummary(
  anthropic: Anthropic,
  items: ScoredAssignment[],
): Promise<string | null> {
  if (items.length === 0) return null;

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Upcoming assignments, ranked by impact score (highest first):\n\n${items
            .map(formatAssignmentLine)
            .join("\n")}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    return textBlock?.text.trim() || null;
  } catch (error) {
    console.error("getFocusSummary failed:", error);
    return null;
  }
}
