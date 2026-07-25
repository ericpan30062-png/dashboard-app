import { parseDueDate, daysUntil, urgencyMultiplier } from "@/lib/grade-impact";
import type { Assignment } from "@/generated/prisma/client";

// An assignment counts as "avoided" once it's sat untouched for a few days
// with the exam/paper/etc. closing in — not the moment it's created (that
// would flag everything on day one) and not once it's so far out that
// there's no urgency yet.
export const AVOIDANCE_MIN_AGE_DAYS = 3;
export const AVOIDANCE_DUE_WINDOW_DAYS = 10;

export type AvoidedAssignment = {
  assignment: Assignment;
  daysSinceCreated: number;
  daysUntilDue: number;
  // weight x urgencyMultiplier — the same scoring grade-impact.ts uses for
  // the Priorities page, reused here so "most critical avoided item" is a
  // deterministic ranking rather than something an LLM has to infer from a
  // raw list.
  impactScore: number;
};

function daysSince(date: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((now.getTime() - date.getTime()) / msPerDay);
}

// Flags assignments that are old enough to no longer be "just added", due
// soon enough to matter, and have no StudySession row (i.e. never scheduled
// via backward planning) — sorted most-critical-first.
export function findAvoidedAssignments(
  assignments: (Assignment & { studySessions: { id: string }[] })[],
  now: Date = new Date(),
): AvoidedAssignment[] {
  const avoided: AvoidedAssignment[] = [];

  for (const assignment of assignments) {
    if (assignment.studySessions.length > 0) continue;

    const dueDate = parseDueDate(assignment.dueDate);
    if (!dueDate) continue;

    const daysUntilDue = daysUntil(dueDate, now);
    if (daysUntilDue < 0 || daysUntilDue > AVOIDANCE_DUE_WINDOW_DAYS) continue;

    const daysSinceCreated = daysSince(assignment.createdAt, now);
    if (daysSinceCreated <= AVOIDANCE_MIN_AGE_DAYS) continue;

    const impactScore = (assignment.weight ?? 0) * urgencyMultiplier(daysUntilDue);

    avoided.push({ assignment, daysSinceCreated, daysUntilDue, impactScore });
  }

  return avoided.sort(
    (a, b) => b.impactScore - a.impactScore || b.daysSinceCreated - a.daysSinceCreated,
  );
}
