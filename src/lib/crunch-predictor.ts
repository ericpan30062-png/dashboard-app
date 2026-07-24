import type { Assignment } from "@/generated/prisma/client";
import type { AssignmentType } from "@/generated/prisma/enums";
import { parseDueDate, daysUntil } from "@/lib/grade-impact";
import { dateKey, type CalendarBusyInterval } from "@/lib/google-calendar";

const DUE_SOON_WINDOW_DAYS = 3;

// Fallback used when an assignment has no real estimate from the study
// session sizer (src/lib/study-sizer.ts) yet. These are rough, documented
// guesses — good enough for a relative "how loaded is this day" signal, not
// a precise time budget.
const HEURISTIC_HOURS_BY_TYPE: Record<AssignmentType, number> = {
  HOMEWORK: 2,
  PAPER: 6,
  EXAM: 4,
  PROJECT: 10,
};

// Relative weights turning three different units (grade percentage points,
// event count, hours) into one comparable score. Exact values matter less
// than their proportions, since intensity is min-max normalized afterward.
const WEIGHT_POINTS_PER_PERCENT = 2;
const POINTS_PER_EVENT = 8;
const POINTS_PER_HOUR = 6;

export type DueSoonAssignment = {
  id: string;
  name: string;
  weight: number | null;
  type: AssignmentType;
};

export type DayLoad = {
  date: string; // YYYY-MM-DD
  dueSoonAssignments: DueSoonAssignment[];
  dueWeightSum: number;
  eventCount: number;
  hoursNeededSum: number;
  rawScore: number;
  intensity: number; // 0-100, min-max normalized across the computed range
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function computeDailyLoads(
  assignments: Assignment[],
  busyIntervals: CalendarBusyInterval[],
  today: Date,
  days = 30,
): DayLoad[] {
  const parsedAssignments = assignments
    .map((a) => ({ assignment: a, dueDate: parseDueDate(a.dueDate) }))
    .filter((a): a is { assignment: Assignment; dueDate: Date } => a.dueDate !== null);

  const start = startOfDay(today);
  const raw: Omit<DayLoad, "intensity">[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const nextDay = addDays(day, 1);

    const dueSoon = parsedAssignments.filter(({ dueDate }) => {
      const distance = daysUntil(dueDate, day);
      return distance >= 0 && distance <= DUE_SOON_WINDOW_DAYS;
    });

    const dueWeightSum = dueSoon.reduce((sum, { assignment }) => sum + (assignment.weight ?? 0), 0);
    const hoursNeededSum = dueSoon.reduce(
      (sum, { assignment }) =>
        sum + (assignment.estimatedHours ?? HEURISTIC_HOURS_BY_TYPE[assignment.type]),
      0,
    );
    const eventCount = busyIntervals.filter((b) => b.start < nextDay && b.end > day).length;

    const rawScore =
      dueWeightSum * WEIGHT_POINTS_PER_PERCENT +
      eventCount * POINTS_PER_EVENT +
      hoursNeededSum * POINTS_PER_HOUR;

    raw.push({
      date: dateKey(day),
      dueSoonAssignments: dueSoon.map(({ assignment }) => ({
        id: assignment.id,
        name: assignment.name,
        weight: assignment.weight,
        type: assignment.type,
      })),
      dueWeightSum,
      eventCount,
      hoursNeededSum,
      rawScore,
    });
  }

  const scores = raw.map((d) => d.rawScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;

  return raw.map((d) => ({
    ...d,
    intensity: range === 0 ? 0 : ((d.rawScore - min) / range) * 100,
  }));
}

// Green (low) -> yellow -> red (high), getting more saturated and darker as
// intensity rises so the busiest days read as visually "hottest".
export function intensityToColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(100, intensity));
  const hue = 120 - (clamped / 100) * 120;
  const saturation = 55 + (clamped / 100) * 25;
  const lightness = 88 - (clamped / 100) * 43;
  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

export function intensityTextIsLight(intensity: number): boolean {
  return intensity > 55;
}
