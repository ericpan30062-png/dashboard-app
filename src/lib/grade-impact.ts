import type { Assignment } from "@/generated/prisma/client";

export type ScoredAssignment = {
  assignment: Assignment;
  dueDateParsed: Date | null;
  daysUntilDue: number | null;
  urgencyMultiplier: number;
  impactScore: number;
};

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

// Builds a local-time Date and rejects anything that overflowed (e.g.
// month=13 or day=32 silently rolling into the next month/year), so a
// malformed date reads as unparseable rather than a wrong date.
function toLocalDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// The syllabus-extraction prompt asks Claude for YYYY-MM-DD when a specific
// date is given, but `dueDate` is free text (see prisma/schema.prisma) and
// can also be something like "Week 5" or "TBD" that a user typed in during
// review. Only a handful of explicit formats are accepted — deliberately
// NOT falling back to the built-in `new Date(string)` parser, which is
// notoriously lenient and will silently turn a string like "Week 5" into
// some unrelated valid-looking date instead of failing.
export function parseDueDate(dueDate: string | null): Date | null {
  if (!dueDate) return null;
  const trimmed = dueDate.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return toLocalDate(Number(year), Number(month), Number(day));
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return toLocalDate(Number(year), Number(month), Number(day));
  }

  const monthNameMatch = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthNameMatch) {
    const [, monthName, day, year] = monthNameMatch;
    const monthIndex = MONTH_NAMES.findIndex((m) =>
      monthName.toLowerCase().startsWith(m),
    );
    if (monthIndex !== -1) {
      return toLocalDate(Number(year), monthIndex + 1, Number(day));
    }
  }

  return null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(dueDate: Date, now: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / msPerDay,
  );
}

// Spec: >14 days = 1x, 7-14 days = 1.5x, 3-7 days = 2x, <3 days = 3x.
// Boundaries are non-overlapping: 7 and 14 belong to the 1.5x bucket, 3
// belongs to the 2x bucket.
export function urgencyMultiplier(daysUntilDue: number): number {
  if (daysUntilDue < 3) return 3;
  if (daysUntilDue < 7) return 2;
  if (daysUntilDue <= 14) return 1.5;
  return 1;
}

// Scores every assignment and keeps only "upcoming" ones — a parseable due
// date that hasn't passed yet. Assignments with an unparseable or missing
// due date are returned separately since there's no due date to rank them
// against.
export function scoreUpcomingAssignments(
  assignments: Assignment[],
  now: Date = new Date(),
): { scored: ScoredAssignment[]; undated: Assignment[] } {
  const scored: ScoredAssignment[] = [];
  const undated: Assignment[] = [];

  for (const assignment of assignments) {
    const dueDateParsed = parseDueDate(assignment.dueDate);
    if (!dueDateParsed) {
      undated.push(assignment);
      continue;
    }

    const days = daysUntil(dueDateParsed, now);
    if (days < 0) continue; // not "upcoming"

    const multiplier = urgencyMultiplier(days);
    const weight = assignment.weight ?? 0;

    scored.push({
      assignment,
      dueDateParsed,
      daysUntilDue: days,
      urgencyMultiplier: multiplier,
      impactScore: weight * multiplier,
    });
  }

  return { scored, undated };
}

export function sortByImpactDesc(items: ScoredAssignment[]): ScoredAssignment[] {
  return [...items].sort((a, b) => b.impactScore - a.impactScore);
}

export function sortByDueDateAsc(items: ScoredAssignment[]): ScoredAssignment[] {
  return [...items].sort(
    (a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0),
  );
}
