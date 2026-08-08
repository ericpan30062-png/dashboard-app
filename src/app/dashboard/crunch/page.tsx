import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getAuthenticatedClient, listBusyIntervals } from "@/lib/google-calendar";
import { computeDailyLoads } from "@/lib/crunch-predictor";
import { getCrunchAnalysis } from "@/lib/crunch-summary";
import { getAnthropicClientForUser } from "@/lib/anthropic";
import { CrunchHeatmap } from "@/components/dashboard/crunch-heatmap";

export default async function CrunchPage() {
  await auth.protect();
  const user = await getOrCreateUser();

  const assignments = user
    ? await prisma.assignment.findMany({ where: { userId: user.id } })
    : [];

  const client = user ? await getAuthenticatedClient(user.id) : null;

  const header = (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Crunch predictor
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        A 30-day forecast of how loaded each day looks, based on assignments
        due soon, your calendar, and estimated study time.
      </p>
    </div>
  );

  if (!client) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Connect Google Calendar to see your crunch forecast — it factors in
          your actual schedule, not just assignment due dates.{" "}
          <Link
            href="/dashboard/calendar"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Go to Calendar settings
          </Link>
        </p>
      </div>
    );
  }

  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

  let busy;
  try {
    busy = await listBusyIntervals(client, now, horizon);
  } catch (error) {
    console.error("Crunch predictor: listBusyIntervals failed:", error);
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {header}
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Couldn&apos;t read your Google Calendar events — try again in a bit.
        </p>
      </div>
    );
  }

  const dailyLoads = computeDailyLoads(assignments, busy, now);
  const anthropicClient = user ? await getAnthropicClientForUser(user.id) : null;
  const dangerWindows = anthropicClient
    ? await getCrunchAnalysis(anthropicClient, dailyLoads)
    : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {header}
      <CrunchHeatmap days={dailyLoads} dangerWindows={dangerWindows} />
    </div>
  );
}
