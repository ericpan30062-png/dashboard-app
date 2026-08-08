import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { DayLoad } from "@/lib/crunch-predictor";

const DangerWindowSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  title: z.string(),
  reason: z.string(),
  recommendation: z.string(),
});

const CrunchAnalysisSchema = z.object({
  dangerWindows: z.array(DangerWindowSchema),
});

export type DangerWindow = z.infer<typeof DangerWindowSchema>;

const SYSTEM_PROMPT = `You are a workload-risk analyst for a student. You'll see a day-by-day breakdown of the next 30 days. For each day you're given: the total grade weight of assignments due within the next 3 days, how many calendar events/commitments are on that day, and how many hours of study are estimated to be needed for what's due soon, plus a combined load score.

Identify the 2-3 riskiest windows — a window can be a single day or a short span of consecutive days — where the student is most likely to feel overwhelmed or fall behind. Ignore quiet stretches; only surface genuinely risky windows (skip this entirely for a day if nothing stands out).

For each danger window, give:
- title: a short label (e.g. "Midterm + project deadline collide")
- reason: concretely why it's risky — reference actual assignment names, grade weights, and event counts from the data, not vague generalities
- recommendation: one specific, actionable thing to start early and roughly when to start it

Return at most 3 windows, ordered by severity (worst first).`;

function formatDaysForPrompt(days: DayLoad[]): string {
  return days
    .map((d) => {
      const names =
        d.dueSoonAssignments
          .map((a) => `${a.name} (${a.weight ?? "?"}%, ${a.type.toLowerCase()})`)
          .join(", ") || "none";
      return `${d.date}: due-soon weight=${d.dueWeightSum}, events=${d.eventCount}, hours-needed=${d.hoursNeededSum.toFixed(1)}, load score=${d.rawScore.toFixed(0)} [due soon: ${names}]`;
    })
    .join("\n");
}

// Returns null on failure or when there's nothing worth flagging, so the
// page can render the heat map on its own without the AI analysis.
export async function getCrunchAnalysis(
  anthropic: Anthropic,
  days: DayLoad[],
): Promise<DangerWindow[] | null> {
  if (days.every((d) => d.rawScore === 0)) return null;

  try {
    const message = await anthropic.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: formatDaysForPrompt(days) }],
      output_config: {
        format: zodOutputFormat(CrunchAnalysisSchema),
      },
    });

    const windows = message.parsed_output?.dangerWindows ?? [];
    return windows.length > 0 ? windows.slice(0, 3) : null;
  } catch (error) {
    console.error("getCrunchAnalysis failed:", error);
    return null;
  }
}
