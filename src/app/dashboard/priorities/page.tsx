import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import {
  scoreUpcomingAssignments,
  sortByImpactDesc,
  sortByDueDateAsc,
} from "@/lib/grade-impact";
import { getFocusSummary } from "@/lib/priority-summary";
import { PriorityView } from "@/components/dashboard/priority-view";

export default async function PrioritiesPage() {
  await auth.protect();
  const user = await getOrCreateUser();

  const assignments = user
    ? await prisma.assignment.findMany({ where: { userId: user.id } })
    : [];

  const { scored, undated } = scoreUpcomingAssignments(assignments);
  const byImpact = sortByImpactDesc(scored);
  const byDueDate = sortByDueDateAsc(scored);

  const summary = await getFocusSummary(byImpact);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Grade impact priorities
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upcoming assignments ranked by grade weight and urgency, so you know
          what to work on first.
        </p>
      </div>

      <PriorityView
        byImpact={byImpact}
        byDueDate={byDueDate}
        undated={undated}
        summary={summary}
      />
    </div>
  );
}
