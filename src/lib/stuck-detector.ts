import type { StudySession } from "@/generated/prisma/client";

export type StuckReason = "blocked" | "no_progress";

export type StuckResult = {
  stuck: boolean;
  reason: StuckReason | null;
  session: StudySession | null;
};

// Stuck if any session was explicitly marked BLOCKED, or if a session's
// scheduled end time has passed and the student never checked in
// (still SCHEDULED) — "a study session was scheduled but no progress was
// marked after it." Blocked takes priority when both are true; the most
// recent qualifying session (by scheduledStart) is used for either case.
export function isAssignmentStuck(
  sessions: StudySession[],
  now: Date = new Date(),
): StuckResult {
  const blocked = sessions
    .filter((s) => s.status === "BLOCKED")
    .sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime());
  if (blocked.length > 0) {
    return { stuck: true, reason: "blocked", session: blocked[0] };
  }

  const noProgress = sessions
    .filter((s) => s.status === "SCHEDULED" && s.scheduledEnd.getTime() < now.getTime())
    .sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime());
  if (noProgress.length > 0) {
    return { stuck: true, reason: "no_progress", session: noProgress[0] };
  }

  return { stuck: false, reason: null, session: null };
}
