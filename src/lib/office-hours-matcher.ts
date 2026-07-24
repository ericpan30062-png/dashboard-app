import type { OfficeHours } from "@/generated/prisma/client";
import type { CalendarBusyInterval } from "@/lib/google-calendar";

const DAY_INDEX: Record<OfficeHours["dayOfWeek"], number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

// The next occurrence of a weekly office-hours slot on/after `from`. If
// `from` falls on the target day but after the slot's start time, rolls to
// next week rather than returning an already-passed time today.
export function nextOccurrence(
  oh: Pick<OfficeHours, "dayOfWeek" | "startTime" | "endTime">,
  from: Date,
): { start: Date; end: Date } {
  const targetDay = DAY_INDEX[oh.dayOfWeek];
  const { hour: startHour, minute: startMinute } = parseTime(oh.startTime);
  const { hour: endHour, minute: endMinute } = parseTime(oh.endTime);

  const daysAhead = (targetDay - from.getDay() + 7) % 7;
  let start = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + daysAhead,
    startHour,
    startMinute,
  );
  if (start.getTime() < from.getTime()) {
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, startHour, startMinute);
  }
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), endHour, endMinute);
  return { start, end };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type MatchedSlot = { officeHours: OfficeHours; start: Date; end: Date };

// Among all office-hours entries for a course, finds the earliest upcoming
// occurrence (scanning up to `weeksAhead` weeks per entry) that doesn't
// overlap any of the student's existing calendar events.
export function findNextNonConflictingSlot(
  entries: OfficeHours[],
  busy: CalendarBusyInterval[],
  from: Date,
  weeksAhead = 4,
): MatchedSlot | null {
  const candidates: MatchedSlot[] = [];

  for (const entry of entries) {
    const first = nextOccurrence(entry, from);
    const durationMs = first.end.getTime() - first.start.getTime();

    for (let week = 0; week < weeksAhead; week++) {
      const start = new Date(
        first.start.getFullYear(),
        first.start.getMonth(),
        first.start.getDate() + week * 7,
        first.start.getHours(),
        first.start.getMinutes(),
      );
      const end = new Date(start.getTime() + durationMs);

      if (!busy.some((b) => overlaps(start, end, b.start, b.end))) {
        candidates.push({ officeHours: entry, start, end });
        break;
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.start.getTime() - b.start.getTime());
  return candidates[0];
}
