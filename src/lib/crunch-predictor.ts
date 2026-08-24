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
// event count, hours) into one comparable score. Grade weight is the
// dominant signal by design — a day carrying more of your grade should
// read as "hotter" even with a light calendar; busyness and estimated
// hours only nudge the score, they don't override it. Exact values matter
// less than their proportions, since intensity is min-max normalized
// afterward.
const WEIGHT_POINTS_PER_PERCENT = 8;
const POINTS_PER_EVENT = 2;
const POINTS_PER_HOUR = 1;

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

// Five-stop scale (calm green -> yellow-green -> amber -> orange -> deep
// red) instead of a single hue sweep, so the heatmap reads as a richer
// gradient rather than three flat bands of color.
export const INTENSITY_COLOR_STOPS: { pct: number; rgb: [number, number, number] }[] = [
  { pct: 0, rgb: [110, 231, 183] }, // emerald-300
  { pct: 25, rgb: [190, 219, 92] }, // yellow-green
  { pct: 50, rgb: [250, 204, 21] }, // amber-400
  { pct: 75, rgb: [251, 146, 60] }, // orange-400
  { pct: 100, rgb: [185, 28, 28] }, // red-700
];

function intensityToRgb(intensity: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(100, intensity));
  let lower = INTENSITY_COLOR_STOPS[0];
  let upper = INTENSITY_COLOR_STOPS[INTENSITY_COLOR_STOPS.length - 1];
  for (let i = 0; i < INTENSITY_COLOR_STOPS.length - 1; i++) {
    if (clamped >= INTENSITY_COLOR_STOPS[i].pct && clamped <= INTENSITY_COLOR_STOPS[i + 1].pct) {
      lower = INTENSITY_COLOR_STOPS[i];
      upper = INTENSITY_COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = upper.pct - lower.pct || 1;
  const t = (clamped - lower.pct) / span;
  return [0, 1, 2].map((i) => Math.round(lower.rgb[i] + (upper.rgb[i] - lower.rgb[i]) * t)) as [
    number,
    number,
    number,
  ];
}

export function intensityToColor(intensity: number): string {
  const [r, g, b] = intensityToRgb(intensity);
  return `rgb(${r} ${g} ${b})`;
}

// Relative luminance rather than a fixed intensity cutoff, since the
// multi-stop scale no longer gets uniformly darker as intensity rises.
export function intensityTextIsLight(intensity: number): boolean {
  const [r, g, b] = intensityToRgb(intensity).map((c) => c / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.6;
}
