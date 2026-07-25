import { prisma } from "@/lib/prisma";
import { findAvoidedAssignments, type AvoidedAssignment } from "@/lib/procrastination-detector";
import { generateProcrastinationNudge } from "@/lib/procrastination-nudge";
import { getAuthenticatedClient } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/gmail";

const NUDGE_COOLDOWN_HOURS = 48;

export type ProcrastinationNudgeCheckResult = {
  usersChecked: number;
  nudged: number;
  skippedNoAvoidance: number;
  skippedCooldown: number;
  skippedNoGoogle: number;
  errors: { userId: string; message: string }[];
};

// Drops any candidate whose most recent nudge (across all assignments, not
// just this one) landed within the cooldown window, keeping the list
// ordered by impactScore so the next-most-critical item takes over when the
// top pick is still cooling down.
async function filterOutOnCooldown(
  candidates: AvoidedAssignment[],
  now: Date,
): Promise<AvoidedAssignment[]> {
  if (candidates.length === 0) return [];

  const recentNudges = await prisma.procrastinationNudge.findMany({
    where: { assignmentId: { in: candidates.map((c) => c.assignment.id) } },
    orderBy: { createdAt: "desc" },
  });

  const lastNudgedAt = new Map<string, Date>();
  for (const nudge of recentNudges) {
    if (!lastNudgedAt.has(nudge.assignmentId)) {
      lastNudgedAt.set(nudge.assignmentId, nudge.createdAt);
    }
  }

  const cooldownMs = NUDGE_COOLDOWN_HOURS * 60 * 60 * 1000;
  return candidates.filter((c) => {
    const last = lastNudgedAt.get(c.assignment.id);
    return !last || now.getTime() - last.getTime() >= cooldownMs;
  });
}

// Meant to run daily (see GET /api/cron/procrastination-nudge). For each
// user, flags avoided assignments (findAvoidedAssignments), picks the most
// critical one that isn't still in its 48h cooldown, and — if the user has
// Google connected — sends a Claude-drafted nudge email and records it so
// the same assignment won't be nudged again too soon. Users without a
// connected Google account are skipped rather than erroring, same as other
// optional-integration paths in this app (Canvas, Calendar).
export async function runProcrastinationNudgeCheck(
  now: Date = new Date(),
): Promise<ProcrastinationNudgeCheckResult> {
  const users = await prisma.user.findMany({
    include: { assignments: { include: { studySessions: { select: { id: true } } } } },
  });

  const result: ProcrastinationNudgeCheckResult = {
    usersChecked: 0,
    nudged: 0,
    skippedNoAvoidance: 0,
    skippedCooldown: 0,
    skippedNoGoogle: 0,
    errors: [],
  };

  for (const user of users) {
    result.usersChecked += 1;

    const avoided = findAvoidedAssignments(user.assignments, now);
    if (avoided.length === 0) {
      result.skippedNoAvoidance += 1;
      continue;
    }

    const eligible = await filterOutOnCooldown(avoided, now);
    if (eligible.length === 0) {
      result.skippedCooldown += 1;
      continue;
    }

    const target = eligible[0];

    try {
      const client = await getAuthenticatedClient(user.id);
      if (!client) {
        result.skippedNoGoogle += 1;
        continue;
      }

      const message = await generateProcrastinationNudge({
        assignmentName: target.assignment.name,
        assignmentType: target.assignment.type,
        course: target.assignment.course,
        daysUntilDue: target.daysUntilDue,
        daysAvoided: target.daysSinceCreated,
        weight: target.assignment.weight,
      });

      await sendEmail(client, {
        to: user.email,
        subject: `Nudge: ${target.assignment.name}`,
        body: message,
      });

      await prisma.procrastinationNudge.create({
        data: { userId: user.id, assignmentId: target.assignment.id, message },
      });

      result.nudged += 1;
    } catch (error) {
      console.error(`Procrastination nudge failed for user ${user.id}:`, error);
      result.errors.push({
        userId: user.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
