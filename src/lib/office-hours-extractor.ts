import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic } from "@/lib/anthropic";

const DayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const OfficeHoursEntrySchema = z.object({
  instructorName: z.string(),
  instructorEmail: z.string().nullable(),
  dayOfWeek: DayOfWeekEnum,
  startTime: z.string(), // "HH:MM", 24-hour
  endTime: z.string(),
  location: z.string(), // room, or a Zoom/Meet link
});

const OfficeHoursExtractionSchema = z.object({
  entries: z.array(OfficeHoursEntrySchema),
});

export type OfficeHoursEntry = z.infer<typeof OfficeHoursEntrySchema>;

const SYSTEM_PROMPT = `You extract office hours from a course syllabus's raw text.

Find every professor's and TA's office hours mentioned. For each, report:
- instructorName: their name as written (e.g. "Prof. Smith", "TA Jane Lee")
- instructorEmail: their email address if the syllabus states one near their office hours or name, otherwise null — never guess or invent one
- dayOfWeek: one of MONDAY/TUESDAY/WEDNESDAY/THURSDAY/FRIDAY/SATURDAY/SUNDAY. If a range of days is given (e.g. "Mon/Wed 2-3pm"), create one entry per day.
- startTime / endTime: 24-hour "HH:MM" (e.g. "14:00", not "2pm")
- location: the room number, building, or a Zoom/video call link — whatever is given

If no office hours are mentioned at all, return an empty entries array. Do not invent entries that aren't actually in the text.`;

export async function extractOfficeHours(
  courseName: string,
  syllabusText: string,
): Promise<OfficeHoursEntry[]> {
  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Course: ${courseName}\n\nSyllabus text:\n\n${syllabusText}`,
      },
    ],
    output_config: {
      format: zodOutputFormat(OfficeHoursExtractionSchema),
    },
  });

  return message.parsed_output?.entries ?? [];
}
