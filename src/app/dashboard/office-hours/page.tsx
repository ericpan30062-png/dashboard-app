import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { isAssignmentStuck } from "@/lib/stuck-detector";
import { OfficeHoursTable } from "@/components/dashboard/office-hours-table";
import { StudySessionCheckins } from "@/components/dashboard/study-session-checkins";
import { StuckAssignments } from "@/components/dashboard/stuck-assignments";

export default async function OfficeHoursPage() {
  await auth.protect();
  const user = await getOrCreateUser();

  if (!user) {
    return null;
  }

  const now = new Date();

  const [officeHours, assignments, pendingCheckins] = await Promise.all([
    prisma.officeHours.findMany({
      where: { userId: user.id },
      orderBy: [{ course: "asc" }, { dayOfWeek: "asc" }],
    }),
    prisma.assignment.findMany({
      where: { userId: user.id },
      include: { studySessions: true },
    }),
    prisma.studySession.findMany({
      where: { userId: user.id, status: "SCHEDULED", scheduledEnd: { lt: now } },
      include: { assignment: true },
      orderBy: { scheduledEnd: "desc" },
    }),
  ]);

  const stuckAssignments = assignments
    .map((a) => ({ assignment: a, stuck: isAssignmentStuck(a.studySessions, now) }))
    .filter((x) => x.stuck.stuck);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Office hours &amp; stuck check-ins
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Store office hours, check in on scheduled study sessions, and get a
          drafted email nudge when you&apos;re stuck.
        </p>
      </div>

      <StudySessionCheckins sessions={pendingCheckins} />

      <StuckAssignments items={stuckAssignments} />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Office hours
        </h3>
        <OfficeHoursTable initialOfficeHours={officeHours} />
      </div>
    </div>
  );
}
